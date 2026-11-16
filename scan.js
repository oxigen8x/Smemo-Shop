// Scansione scontrino: OCR locale (Tesseract.js), lettura delle righe con prezzo e abbinamento agli articoli.
import { norm, guess } from './catalog.js';

/* ───────────── OCR ───────────── */
let BASE = '';
const initBase = () => { BASE = new URL('vendor/tesseract/', document.baseURI).href.replace(/\/$/, ''); };
// Modulo WebAssembly minimo che usa SIMD: serve a scegliere la build del motore adatta al telefono
const SIMD_PROBE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.Tesseract) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Motore di scansione non disponibile (serve connessione la prima volta).'));
    document.head.append(s);
  });
}

/** Grigio + stiramento del contrasto (2°–98° percentile), sul posto. Migliora molto l'OCR su carta termica. */
export function enhance(canvas) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
    d[i] = d[i + 1] = d[i + 2] = g;
    hist[g | 0]++;
  }
  const total = w * h;
  let acc = 0, lo = 0, hi = 255;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= total * 0.02) { lo = i; break; } }
  acc = 0;
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc >= total * 0.02) { hi = i; break; } }
  if (hi - lo > 20) {
    const k = 255 / (hi - lo);
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.max(0, Math.min(255, (d[i] - lo) * k));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Ridimensiona (e migliora) la foto di un file per un OCR più veloce e preciso. */
export async function preprocess(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const long = Math.max(bmp.width, bmp.height);
  const short = Math.min(bmp.width, bmp.height);
  const scale = Math.min(2400 / long, Math.min(3, Math.max(1, 1200 / short)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d', { willReadFrequently: true }).drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  return enhance(canvas);
}

/**
 * Crea un lettore OCR riutilizzabile (il caricamento costa qualche secondo, quindi si crea una volta sola).
 * Restituisce { read(canvas) → testo, close() }.
 */
export async function createOcr(onStatus) {
  initBase();
  onStatus?.('Carico il motore di lettura…', 0.05);
  await loadScript(BASE + '/tesseract.min.js');
  const simd = WebAssembly.validate(SIMD_PROBE);
  const worker = await window.Tesseract.createWorker('ita', 1, {
    workerPath: BASE + '/worker.min.js',
    corePath: BASE + (simd ? '/tesseract-core-simd-lstm.wasm.js' : '/tesseract-core-lstm.wasm.js'),
    langPath: BASE + '/lang',
    logger: (m) => {
      if (/loading|initializing/.test(m.status)) onStatus?.('Carico il motore di lettura…', 0.05 + (m.progress || 0) * 0.1);
    },
  });
  await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
  let closed = false;
  return {
    /** Legge il testo; con minConf scarta le righe che il motore stesso giudica poco affidabili (utile sui fotogrammi mossi). */
    async read(canvas, { minConf = 0 } = {}) {
      if (closed) throw new Error('annullato');
      const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
      const lines = [];
      for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) lines.push(l);
      if (!lines.length) return data.text || '';
      return lines.filter((l) => l.confidence >= minConf).map((l) => l.text.replace(/\s+$/, '')).join('\n');
    },
    async close() {
      if (closed) return;
      closed = true;
      try { await worker.terminate(); } catch { /* ok */ }
    },
  };
}

/* ───────────── unione delle righe tra più letture ───────────── */
const lineKey = (l) => norm(l).replace(/[^a-z0-9]/g, '');
function levFull(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
/** Somiglianza 0..1 tra due righe già normalizzate (tollera gli errori di lettura). */
function lineSim(a, b) {
  if (a === b) return 1;
  if (a.length < 4 || b.length < 4) return 0;
  const max = Math.max(a.length, b.length);
  if (Math.abs(a.length - b.length) > max * 0.35) return 0;
  return 1 - levFull(a, b) / max;
}
const SIM_OK = 0.74;

function cleanLines(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/[|_]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((l) => {
      const alnum = (l.match(/[A-Za-z0-9À-ÿ]/g) || []).length;
      const nonSpace = l.replace(/\s/g, '').length;
      return alnum >= 3 && alnum / nonSpace >= 0.45;
    });
}

/**
 * Compone lo scontrino da più letture parziali (foto o fotogrammi) che si sovrappongono:
 * trova dove le prime righe della nuova lettura coincidono con le ultime già note e aggiunge solo il resto.
 */
export class ReceiptMerger {
  constructor() { this.lines = []; this.gaps = 0; }
  get text() { return this.lines.join('\n'); }

  /** Restituisce { added, aligned }: aligned=false se non si trova nessuna sovrapposizione (si è saltato un pezzo). */
  add(text) {
    const B = cleanLines(text);
    if (!B.length) return { added: 0, aligned: true };
    if (!this.lines.length) { this.lines = B; return { added: B.length, aligned: true }; }
    const tail = this.lines.slice(-25);
    const A = tail.map(lineKey);
    const Bk = B.map(lineKey);
    const M = A.map((a) => Bk.map((b) => lineSim(a, b) >= SIM_OK));
    let best = null;
    for (let j0 = 0; j0 < A.length; j0++) {
      let p = 0, m = 0, lastQ = -1;
      for (let i = j0; i < A.length; i++) {
        let found = -1;
        for (let q = p; q < Math.min(B.length, p + 3); q++) if (M[i][q]) { found = q; break; }
        if (found >= 0) { m++; p = found + 1; lastQ = found; }
      }
      const compared = A.length - j0;
      if (m < 2 && !(m === 1 && compared <= 2)) continue;
      const score = m * 10 - (compared - m) * 4;
      if (!best || score > best.score) best = { score, lastQ };
    }
    if (!best) {
      // nessuna sovrapposizione: probabile salto. Accodiamo comunque, con un separatore.
      this.gaps++;
      this.lines.push('', ...B);
      return { added: B.length, aligned: false };
    }
    const rest = B.slice(best.lastQ + 1);
    this.lines.push(...rest);
    return { added: rest.length, aligned: true };
  }
}

/* ───────────── scansione dinamica con la fotocamera ───────────── */
const ANALYSIS_W = 160; // larghezza della miniatura usata per movimento/nitidezza
const MOTION_MAX = 80; // oltre: movimento brusco (la nitidezza da sola non basta a capirlo)
const CHANGE_MIN = 5; // sotto: la vista è uguale all'ultima letta, inutile rileggere
const SHARP_REL = 0.6; // nitidezza minima rispetto al recente massimo
const BRIGHT_MIN = 0.12; // quota minima di pixel chiari (carta) nel riquadro
const MIN_LINE_CONF = 60; // sotto questa affidabilità (0-100) una riga letta da un fotogramma viene scartata

function grayThumb(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data;
  const g = new Uint8Array(w * h);
  for (let i = 0, k = 0; i < d.length; i += 4, k++) g[k] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
  return g;
}
function sharpness(g, w, h) {
  let s = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    s += Math.abs(g[i + 1] - g[i - 1]) + Math.abs(g[i + w] - g[i - w]);
    n++;
  }
  return n ? s / n : 0;
}
const meanAbsDiff = (a, b) => {
  if (!a || !b || a.length !== b.length) return 255;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
};

/**
 * Legge lo scontrino mentre l'utente muove il telefono. Ogni ~200 ms valuta il fotogramma (movimento, nitidezza,
 * presenza di carta); quando il lettore è libero e il fotogramma è buono lo legge e ne unisce le righe a quelle già note.
 * onUpdate({ type: 'busy' | 'result' | 'hint', ... }).
 */
export class LiveScanner {
  constructor({ video, guide, ocr, onUpdate }) {
    Object.assign(this, { video, guide, ocr, onUpdate });
    this.merger = new ReceiptMerger();
    this.an = document.createElement('canvas');
    this.anCtx = this.an.getContext('2d', { willReadFrequently: true });
    this.prev = null;
    this.lastCap = null;
    this.recentMax = 0;
    this.busy = false;
    this.captures = 0;
    this.timer = null;
  }
  start() { if (!this.timer) this.timer = setInterval(() => this.tick(), 200); }
  stop() { clearInterval(this.timer); this.timer = null; }

  /** Rettangolo del riquadro guida, in pixel del video (tiene conto di object-fit: cover). */
  cropRect() {
    const v = this.video;
    const vr = v.getBoundingClientRect();
    const g = this.guide.getBoundingClientRect();
    const vw = v.videoWidth, vh = v.videoHeight;
    if (!vw || !vh || !vr.width) return null;
    const scale = Math.max(vr.width / vw, vr.height / vh);
    const offX = (vr.width - vw * scale) / 2;
    const offY = (vr.height - vh * scale) / 2;
    let sx = (g.left - vr.left - offX) / scale;
    let sy = (g.top - vr.top - offY) / scale;
    let sw = g.width / scale;
    let sh = g.height / scale;
    sx = Math.max(0, sx); sy = Math.max(0, sy);
    sw = Math.min(vw - sx, sw); sh = Math.min(vh - sy, sh);
    return sw > 20 && sh > 20 ? { sx, sy, sw, sh } : null;
  }

  tick() {
    const r = this.cropRect();
    if (!r) return;
    const w = ANALYSIS_W;
    const h = Math.max(8, Math.round((w * r.sh) / r.sw));
    this.an.width = w; this.an.height = h;
    this.anCtx.drawImage(this.video, r.sx, r.sy, r.sw, r.sh, 0, 0, w, h);
    const g = grayThumb(this.anCtx, w, h);
    const sharp = sharpness(g, w, h);
    let bright = 0;
    for (let i = 0; i < g.length; i++) if (g[i] > 150) bright++;
    bright /= g.length;
    const motion = this.prev ? meanAbsDiff(g, this.prev) : 0;
    this.prev = g;
    this.recentMax = Math.max(sharp, this.recentMax * 0.95); // il "recente massimo" decade in pochi secondi
    if (this.busy) return;
    if (bright < BRIGHT_MIN) return this.onUpdate({ type: 'hint', hint: 'noReceipt' });
    if (motion > MOTION_MAX) return this.onUpdate({ type: 'hint', hint: 'steady' });
    if (sharp < this.recentMax * SHARP_REL) return this.onUpdate({ type: 'hint', hint: 'focus' });
    if (this.captures > 0 && meanAbsDiff(g, this.lastCap) < CHANGE_MIN) return; // nulla di nuovo
    this.capture(r, g);
  }

  /** Scatto manuale ("a sezioni"). Restituisce false se il lettore è ancora occupato. */
  shoot() {
    if (this.busy) return false;
    const r = this.cropRect();
    if (!r) return false;
    this.capture(r, null);
    return true;
  }

  async capture(r, thumb) {
    this.busy = true;
    this.lastCap = thumb;
    this.onUpdate({ type: 'busy' });
    let res = { added: 0, aligned: true };
    try {
      const scale = Math.min(1, 1500 / r.sw);
      const c = document.createElement('canvas');
      c.width = Math.round(r.sw * scale);
      c.height = Math.round(r.sh * scale);
      c.getContext('2d', { willReadFrequently: true }).drawImage(this.video, r.sx, r.sy, r.sw, r.sh, 0, 0, c.width, c.height);
      enhance(c);
      res = this.merger.add(await this.ocr.read(c, { minConf: MIN_LINE_CONF }));
      this.captures++;
    } catch { /* lettore chiuso o errore: si prosegue */ }
    this.busy = false;
    this.onUpdate({ type: 'result', ...res });
  }

  /** Si risolve quando non c'è più una lettura in corso. */
  idle() {
    return new Promise((resolve) => {
      const t = setInterval(() => { if (!this.busy) { clearInterval(t); resolve(); } }, 50);
    });
  }
}

/* ───────────── lettura righe ───────────── */
const PRICE = String.raw`(\d{1,4}\s?[.,]\s?\d{2})`;
// riga articolo: testo con lettere + prezzo finale (con eventuale lettera/codice IVA o simbolo euro)
const ITEM_RE = new RegExp(String.raw`^(.*?[A-Za-zÀ-ÿ].*?)\s+€?\s?${PRICE}\s*(?:€|eur)?\s*(?:[A-Za-z]|\d{1,2}|\*)?\s*$`, 'i');
const QTY_RE = new RegExp(String.raw`^(\d{1,3})\s*[xX*]\s*${PRICE}\s+${PRICE}\s*(?:[A-Za-z]|\d{1,2})?\s*$`);
const SKIP_RE = /\b(sub\s?-?totale|iva|resto|contanti|pagamento|pagato|bancomat|arrotond\w*|n\.?\s?art\w*|numero art\w*|di cui|carta di (credito|debito)|sconto|sconti|saldo|punti|bollino|buono|credito)\b/i;
const TOTAL_RE = /\b(totale|tot\.?|importo)\b(?!\s*iva)/i;

const toNum = (s) => parseFloat(s.replace(/\s/g, '').replace(',', '.'));

/** Pulisce il testo di una riga per ottenere un nome leggibile. */
export function cleanName(s) {
  const t = s
    .replace(/^\s*\d{1,3}\s*[xX*]\s+/, '') // "2 x "
    .replace(/^\s*\d{4,}\s+/, '') // codice a barre/reparto iniziale
    .replace(/\bn\.?\s?\d+\b/gi, ' ') // "N.5"
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:kg|gr|g|ml|cl|lt|l|pz|rt|x)\b/gi, ' ') // "500G", "1,5L", "8RT"
    .replace(/[^A-Za-zÀ-ÿ' .]/g, ' ') // via numeri e simboli
    .replace(/(^|\s)[A-Za-zÀ-ÿ]\.?(?=\s|$)/g, ' ') // lettere isolate rimaste
    .replace(/\s+/g, ' ')
    .replace(/^[ .'-]+|[ .'-]+$/g, '');
  return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : '';
}

/**
 * Estrae dalle righe dell'OCR gli articoli con prezzo e il totale.
 * Restituisce { items: [{ raw, name, price, qty }], total }.
 */
export function parseReceipt(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/[|_]/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const items = [];
  let total = null;
  for (const line of lines) {
    const qm = line.match(QTY_RE);
    if (qm && items.length) { // "3 x 0,89   2,67" sotto il nome dell'articolo
      const last = items[items.length - 1];
      last.qty = parseInt(qm[1], 10);
      last.price = toNum(qm[3]);
      continue;
    }
    const m = line.match(ITEM_RE);
    if (!m) continue;
    const price = toNum(m[2]);
    if (!(price > 0)) continue;
    if (TOTAL_RE.test(m[1]) && !/sub/i.test(m[1])) {
      if (total == null || price > total) total = price;
      continue;
    }
    if (SKIP_RE.test(m[1])) continue;
    if (/^-/.test(m[2])) continue;
    const name = cleanName(m[1]);
    if ((name.match(/[A-Za-zÀ-ÿ]/g) || []).length < 3) continue;
    items.push({ raw: m[1], name, price, qty: 1 });
  }
  return { items, total };
}

/* ───────────── abbinamento agli articoli ───────────── */
/** Chiave per ricordare una riga di scontrino: solo parole, senza numeri. */
export const aliasKey = (raw) => norm(raw).split(/[^a-z]+/).filter((t) => t.length >= 2).join(' ');

function lev(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 3;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
function tokMatch(x, t) {
  if (x === t) return true;
  const minLen = Math.min(x.length, t.length);
  if (minLen >= 4 && (x.startsWith(t) || t.startsWith(x))) return true;
  if (minLen >= 5) return lev(x, t) <= (minLen >= 9 ? 2 : 1); // tollera errori di lettura
  return false;
}

/**
 * Trova l'articolo che corrisponde a una riga di scontrino.
 * Ordine: righe già associate in passato → nome dell'articolo → sinonimi del catalogo.
 * Restituisce { articleId, via } oppure null.
 */
export function matchArticle(raw, articles, aliases = []) {
  const key = aliasKey(raw);
  if (!key) return null;
  const al = aliases.find((a) => a.key === key);
  if (al && articles.some((a) => a.id === al.articleId)) return { articleId: al.articleId, via: 'alias' };
  const toks = key.split(' ');
  let best = null;
  for (const a of articles) {
    const at = norm(a.name).split(/[^a-z]+/).filter((t) => t.length >= 2);
    if (!at.length) continue;
    const hits = at.filter((t) => toks.some((x) => tokMatch(x, t))).length;
    const cov = hits / at.length;
    if (cov < 1 && !(at.length >= 3 && cov >= 0.66)) continue;
    const score = cov * 10 + at.join('').length / 100;
    if (!best || score > best.score) best = { score, articleId: a.id };
  }
  if (best) return { articleId: best.articleId, via: 'name' };
  const g = guess(raw);
  if (g) {
    const a = articles.find((x) => norm(x.name) === norm(g.name));
    if (a) return { articleId: a.id, via: 'catalog' };
  }
  return null;
}
