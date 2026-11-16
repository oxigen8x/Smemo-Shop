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

/** Ridimensiona e migliora il contrasto della foto, per un OCR più veloce e preciso. */
export async function preprocess(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const long = Math.max(bmp.width, bmp.height);
  const short = Math.min(bmp.width, bmp.height);
  const scale = Math.min(2400 / long, Math.min(3, Math.max(1, 1200 / short)));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
    d[i] = d[i + 1] = d[i + 2] = g;
    hist[g | 0]++;
  }
  // stiramento del contrasto tra il 2° e il 98° percentile
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

/**
 * Legge il testo da una foto. onStatus(testo, 0..1) per la barra di avanzamento.
 * Restituisce { text, cancel } dove cancel() interrompe l'operazione.
 */
export function recognize(file, onStatus) {
  let worker = null;
  let cancelled = false;
  const cancel = async () => { cancelled = true; try { await worker?.terminate(); } catch { /* ok */ } };
  const promise = (async () => {
    initBase();
    onStatus?.('Preparo la foto…', 0.02);
    const canvas = await preprocess(file);
    if (cancelled) throw new Error('annullato');
    onStatus?.('Carico il motore di lettura…', 0.05);
    await loadScript(BASE + '/tesseract.min.js');
    const simd = WebAssembly.validate(SIMD_PROBE);
    worker = await window.Tesseract.createWorker('ita', 1, {
      workerPath: BASE + '/worker.min.js',
      corePath: BASE + (simd ? '/tesseract-core-simd-lstm.wasm.js' : '/tesseract-core-lstm.wasm.js'),
      langPath: BASE + '/lang',
      logger: (m) => {
        if (m.status === 'recognizing text') onStatus?.('Leggo lo scontrino…', 0.15 + m.progress * 0.85);
        else if (/loading|initializing/.test(m.status)) onStatus?.('Carico il motore di lettura…', 0.05 + (m.progress || 0) * 0.1);
      },
    });
    if (cancelled) throw new Error('annullato');
    await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
    const { data } = await worker.recognize(canvas);
    await worker.terminate();
    worker = null;
    return data.text || '';
  })().catch(async (e) => { try { await worker?.terminate(); } catch { /* ok */ } throw e; });
  return { promise, cancel };
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
