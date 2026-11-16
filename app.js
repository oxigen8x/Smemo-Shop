import * as db from './db.js';

/* ───────────── utilità ───────────── */
const $ = (s, r = document) => r.querySelector(s);

/** Mini "hyperscript": crea elementi DOM senza mai usare innerHTML con dati utente. */
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  for (const k of kids.flat(9)) {
    if (k == null || k === false) continue;
    e.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return e;
}

const ICONS = {
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2.5l2.4 11h10.2L20 8H7"/>',
};
function icon(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'ic');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICONS[name]; // costante interna, nessun dato utente
  return s;
}

const pad = (n) => String(n).padStart(2, '0');
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const parseISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5);
const fmtDate = (iso) =>
  parseISO(iso).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtShort = (iso) => parseISO(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const money = (n) => eur.format(n);
const num = (v) => {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const collator = new Intl.Collator('it', { sensitivity: 'base' });
const byName = (a, b) => collator.compare(a.name, b.name);
const byOrder = (a, b) => (a.order ?? a.id) - (b.order ?? b.id);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Durata leggibile da un numero di giorni (anche frazionario). */
function dur(d) {
  if (d < 1.5) return '1 giorno';
  if (d < 21) return `${Math.round(d)} giorni`;
  if (d < 70) return `${Math.round(d / 7)} settimane`;
  return `${Math.round(d / 30)} mesi`;
}
function ago(days) {
  if (days <= 0) return 'oggi';
  if (days === 1) return 'ieri';
  return dur(days) + ' fa';
}

/* ───────────── preferenze ───────────── */
const prefs = {
  get(k, d) {
    try { return localStorage.getItem('spesa.' + k) ?? d; } catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem('spesa.' + k, v); } catch { /* ignora */ }
  },
};
const HUES = [
  ['Viola', 262], ['Azzurro', 205], ['Verde', 158], ['Arancio', 24], ['Rosa', 336], ['Ambra', 44],
];
function applyPrefs() {
  const t = prefs.get('theme', 'auto');
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  root.style.setProperty('--h', prefs.get('hue', '262'));
  const meta = $('meta[name=theme-color]');
  if (meta) meta.content = dark ? '#14121f' : '#f6f5fb';
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyPrefs);

/* ───────────── stato ───────────── */
const state = { categories: [], articles: [], lists: [], purchases: [] };
async function load() {
  const [categories, articles, lists, purchases] = await Promise.all(db.STORES.map(db.all));
  Object.assign(state, { categories: categories.sort(byOrder), articles, lists, purchases });
}
const artById = (id) => state.articles.find((a) => a.id === id);
const catName = (id) => state.categories.find((c) => c.id === id)?.name ?? 'Senza categoria';

const DEFAULT_CATEGORIES = [
  'Frutta e verdura', 'Pane e panetteria', 'Latticini e uova', 'Carne e pesce',
  'Dispensa', 'Surgelati', 'Bevande', 'Casa e igiene', 'Altro',
];
async function seed() {
  if (state.categories.length || state.articles.length || state.lists.length || state.purchases.length) return;
  for (const [i, name] of DEFAULT_CATEGORIES.entries()) await db.put('categories', { name, order: i + 1 });
  await load();
}

/* ───────────── componenti UI ───────────── */
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  try { t.hidePopover(); t.showPopover(); } catch { t.style.display = 'block'; }
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { try { t.hidePopover(); } catch { t.style.display = 'none'; } }, 2200);
}

function openSheet(title, body, actions = [], onClose) {
  const dlg = h('dialog', { class: 'sheet' });
  const close = () => { if (dlg.open) dlg.close(); };
  dlg.append(
    h('div', { class: 'sheet-in' },
      h('div', { class: 'grab' }),
      h('h2', {}, title),
      h('div', { class: 'sheet-body' }, body),
      actions.length
        ? h('div', { class: 'sheet-actions' },
            actions.map((a) => h('button', { class: 'btn ' + (a.cls || ''), type: 'button', onclick: () => a.run(close) }, a.label)))
        : null)
  );
  dlg.addEventListener('close', () => { dlg.remove(); onClose?.(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  document.body.append(dlg);
  dlg.showModal();
  return { close, el: dlg };
}

function askText(title, label, value = '', okLabel = 'Salva') {
  return new Promise((resolve) => {
    let done = false;
    const input = h('input', { class: 'input', value, placeholder: label, enterkeyhint: 'done', maxlength: 80 });
    const finish = (v, close) => { done = true; resolve(v); close(); };
    const s = openSheet(title, [h('label', { class: 'lbl' }, label), input], [
      { label: 'Annulla', cls: 'ghost', run: (c) => finish(null, c) },
      { label: okLabel, cls: 'primary', run: (c) => finish(input.value, c) },
    ], () => { if (!done) resolve(null); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(input.value, s.close); }
    });
    setTimeout(() => { input.focus(); input.select(); }, 60);
  });
}

function confirmBox(title, msg, okLabel = 'Conferma', danger = false) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v, close) => { done = true; resolve(v); close(); };
    openSheet(title, h('p', { class: 'muted' }, msg), [
      { label: 'Annulla', cls: 'ghost', run: (c) => finish(false, c) },
      { label: okLabel, cls: danger ? 'danger' : 'primary', run: (c) => finish(true, c) },
    ], () => { if (!done) resolve(false); });
  });
}

function categorySelect(selectedId, withNone = true) {
  const sel = h('select', { class: 'input' },
    withNone ? h('option', { value: '' }, 'Senza categoria') : null,
    state.categories.map((c) => h('option', { value: c.id, selected: c.id === selectedId }, c.name)));
  return sel;
}

const pageHead = (title, { back, actions = [] } = {}) =>
  h('header', { class: 'top' },
    back ? h('a', { class: 'icon-btn', href: back, 'aria-label': 'Indietro' }, icon('back')) : null,
    h('h1', {}, title),
    h('div', { class: 'top-actions' }, actions));

const empty = (title, text) =>
  h('div', { class: 'empty' }, h('div', { class: 'empty-ic' }, icon('cart')), h('strong', {}, title), h('p', { class: 'muted' }, text));

const fab = (onclick, label = 'Aggiungi') =>
  h('button', { class: 'fab', onclick, 'aria-label': label }, icon('plus'));

const segmented = (options, current, onPick) =>
  h('div', { class: 'seg', role: 'tablist' },
    options.map(([val, label]) =>
      h('button', { class: val === current ? 'on' : '', type: 'button', role: 'tab', onclick: () => onPick(val) }, label)));

/* ───────────── VISTA: liste ───────────── */
function viewListe() {
  const open = state.lists.filter((l) => l.status === 'open').sort((a, b) => b.createdAt - a.createdAt);
  const wrap = h('section', {}, pageHead('Le mie liste'));
  if (!open.length) {
    wrap.append(empty('Nessuna lista attiva', 'Tocca + per creare una lista e iniziare la spesa.'));
  } else {
    wrap.append(
      h('div', { class: 'stack' },
        open.map((l) => {
          const total = l.items.length;
          const done = l.items.filter((i) => i.checked).length;
          const pct = total ? Math.round((done / total) * 100) : 0;
          return h('a', { class: 'card list-card', href: '#/liste/' + l.id },
            h('div', { class: 'row' }, h('strong', {}, l.name), h('span', { class: 'pill' }, `${done}/${total}`)),
            h('div', { class: 'bar' }, h('i', { style: `width:${pct}%` })),
            h('small', { class: 'muted' }, total ? `${total} articoli · ` : 'Vuota · ', new Date(l.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })));
        }))
    );
  }
  wrap.append(fab(newList, 'Nuova lista'));
  return wrap;
}

async function newList() {
  const name = await askText('Nuova lista', 'Nome della lista', 'Spesa del ' + fmtShort(todayISO()), 'Crea');
  if (name == null) return;
  const id = await db.put('lists', { name: name.trim() || 'Spesa', createdAt: Date.now(), status: 'open', items: [] });
  await load();
  location.hash = '#/liste/' + id;
}

/* ───────────── VISTA: dettaglio lista ───────────── */
function viewLista(id) {
  const list = state.lists.find((l) => l.id === id);
  if (!list || list.status !== 'open') {
    queueMicrotask(() => { location.hash = '#/liste'; });
    return h('div');
  }
  const persist = () => db.put('lists', list);
  const items = list.items.filter((it) => artById(it.articleId));

  const progressText = h('span', { class: 'pill' });
  const barFill = h('i');
  const concludeBtn = h('button', { class: 'btn primary wide', type: 'button', onclick: () => concludeSheet(list) }, 'Concludi spesa');
  const updateProgress = () => {
    const done = items.filter((i) => i.checked).length;
    progressText.textContent = `${done}/${items.length}`;
    barFill.style.width = (items.length ? (done / items.length) * 100 : 0) + '%';
    concludeBtn.disabled = done === 0;
    concludeBtn.classList.toggle('glow', items.length > 0 && done === items.length);
  };

  const groups = new Map();
  for (const it of items) {
    const a = artById(it.articleId);
    const key = state.categories.some((c) => c.id === a.categoryId) ? a.categoryId : null;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ it, a });
  }
  const order = [...state.categories.map((c) => c.id), null].filter((k) => groups.has(k));

  const body = h('div', { class: 'stack tight' });
  for (const key of order) {
    const rows = groups.get(key).sort((x, y) => byName(x.a, y.a));
    body.append(
      h('div', { class: 'group' },
        h('h3', {}, key == null ? 'Senza categoria' : catName(key)),
        rows.map(({ it, a }) => {
          const qty = h('span', { class: 'qty-n' }, it.qty);
          const row = h('div', { class: 'item' + (it.checked ? ' done' : '') });
          const setQty = (d) => {
            it.qty = Math.max(1, Math.min(99, it.qty + d));
            qty.textContent = it.qty;
            persist();
          };
          row.append(
            h('label', { class: 'chk' },
              h('input', {
                type: 'checkbox', checked: it.checked,
                onchange: (e) => { it.checked = e.target.checked; row.classList.toggle('done', it.checked); persist(); updateProgress(); },
              }),
              h('span', { class: 'box' }),
              h('span', { class: 'nm' }, a.name)),
            h('div', { class: 'stepper' },
              h('button', { type: 'button', 'aria-label': 'Meno', onclick: () => setQty(-1) }, '−'),
              qty,
              h('button', { type: 'button', 'aria-label': 'Più', onclick: () => setQty(1) }, '+')),
            h('button', {
              class: 'icon-btn sm', type: 'button', 'aria-label': 'Rimuovi dalla lista',
              onclick: async () => { list.items = list.items.filter((x) => x !== it); await persist(); render(); },
            }, icon('x')));
          return row;
        }))
    );
  }

  const wrap = h('section', { class: 'with-dock' },
    pageHead(list.name, {
      back: '#/liste',
      actions: [
        h('button', {
          class: 'icon-btn', type: 'button', 'aria-label': 'Rinomina',
          onclick: async () => {
            const n = await askText('Rinomina lista', 'Nome della lista', list.name);
            if (n == null || !n.trim()) return;
            list.name = n.trim(); await persist(); render();
          },
        }, icon('edit')),
        h('button', {
          class: 'icon-btn', type: 'button', 'aria-label': 'Elimina lista',
          onclick: async () => {
            if (!(await confirmBox('Eliminare la lista?', `"${list.name}" verrà eliminata senza registrare la spesa.`, 'Elimina', true))) return;
            await db.del('lists', list.id); await load(); location.hash = '#/liste';
          },
        }, icon('trash')),
      ],
    }),
    h('div', { class: 'card progress' }, h('div', { class: 'row' }, h('span', { class: 'muted' }, 'Progresso'), progressText), h('div', { class: 'bar' }, barFill)),
    items.length ? body : empty('Lista vuota', 'Aggiungi gli articoli che ti servono.'),
    h('div', { class: 'dock' },
      h('button', { class: 'btn ghost', type: 'button', onclick: () => addItemsSheet(list) }, icon('plus'), ' Articoli'),
      concludeBtn)
  );
  updateProgress();
  return wrap;
}

function addItemsSheet(list) {
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Cerca o crea un articolo…', autocomplete: 'off' });
  const catSel = categorySelect(Number(prefs.get('newCat', '')) || null);
  const results = h('div', { class: 'results' });
  const catRow = h('div', { class: 'newcat' }, h('label', { class: 'lbl' }, 'Categoria per i nuovi articoli'), catSel);
  catSel.addEventListener('change', () => prefs.set('newCat', catSel.value));

  const addToList = async (a) => {
    list.items.push({ articleId: a.id, qty: 1, checked: false });
    await db.put('lists', list);
    draw();
  };
  const draw = () => {
    const q = search.value.trim();
    const inList = new Set(list.items.map((i) => i.articleId));
    const matches = state.articles.filter((a) => !q || norm(a.name).includes(norm(q))).sort(byName).slice(0, 80);
    const exact = q && state.articles.some((a) => norm(a.name) === norm(q));
    const nodes = [];
    if (q && !exact) {
      nodes.push(h('button', {
        class: 'pick create', type: 'button',
        onclick: async () => {
          const name = cap(q);
          const art = { name, categoryId: Number(catSel.value) || null };
          art.id = await db.put('articles', art);
          state.articles.push(art); // niente load(): manteniamo lo stesso oggetto lista in memoria
          search.value = '';
          await addToList(art);
        },
      }, h('span', {}, `Crea “${cap(q)}”`), h('span', { class: 'plus' }, '+')));
    }
    for (const a of matches) {
      const added = inList.has(a.id);
      nodes.push(h('button', {
        class: 'pick' + (added ? ' added' : ''), type: 'button', disabled: added,
        onclick: () => addToList(a),
      }, h('span', {}, a.name, h('small', { class: 'muted' }, ' · ', catName(a.categoryId))), h('span', { class: 'plus' }, added ? '✓' : '+')));
    }
    if (!nodes.length) nodes.push(h('p', { class: 'muted center' }, 'Nessun articolo. Scrivi un nome per crearlo.'));
    results.replaceChildren(...nodes);
  };
  search.addEventListener('input', draw);
  draw();
  openSheet('Aggiungi articoli', [search, catRow, results], [{ label: 'Fatto', cls: 'primary', run: (c) => c() }], () => render());
}

function concludeSheet(list) {
  const valid = list.items.filter((i) => artById(i.articleId));
  const checked = valid.filter((i) => i.checked);
  const unchecked = valid.filter((i) => !i.checked);
  if (!checked.length) return;

  const dateIn = h('input', { class: 'input', type: 'date', value: todayISO(), max: todayISO() });
  const totalIn = h('input', { class: 'input', type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: 'Totale (facoltativo)' });
  const priceIns = checked.map(() => h('input', { class: 'input price', type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: '€' }));
  const carry = unchecked.length
    ? h('input', { type: 'checkbox', checked: true })
    : null;

  const body = [
    h('label', { class: 'lbl' }, 'Data della spesa'), dateIn,
    h('label', { class: 'lbl' }, 'Totale speso (€)'), totalIn,
    h('details', { class: 'prices' },
      h('summary', {}, 'Importi per articolo (facoltativo)'),
      checked.map((it, i) => {
        const a = artById(it.articleId);
        return h('div', { class: 'price-row' }, h('span', {}, a.name, it.qty > 1 ? ` ×${it.qty}` : ''), priceIns[i]);
      })),
    carry
      ? h('label', { class: 'chk line' }, carry, h('span', { class: 'box' }),
          h('span', { class: 'nm' }, `Sposta i ${unchecked.length} articoli non presi in una nuova lista`))
      : null,
  ];

  openSheet(`Registra spesa (${checked.length} articoli)`, body, [
    { label: 'Annulla', cls: 'ghost', run: (c) => c() },
    {
      label: 'Salva spesa', cls: 'primary',
      run: async (close) => {
        const date = dateIn.value || todayISO();
        const prices = priceIns.map((i) => num(i.value));
        let total = num(totalIn.value);
        if (total == null && prices.some((p) => p != null)) total = Math.round(prices.reduce((s, p) => s + (p || 0), 0) * 100) / 100;
        const purchase = {
          date, total, listId: list.id, listName: list.name, createdAt: Date.now(),
          items: checked.map((it, i) => {
            const a = artById(it.articleId);
            return { articleId: a.id, name: a.name, categoryName: catName(a.categoryId), qty: it.qty, price: prices[i] };
          }),
        };
        await db.put('purchases', purchase);
        list.status = 'done';
        list.completedAt = Date.now();
        await db.put('lists', list);
        if (carry?.checked) {
          await db.put('lists', {
            name: list.name + ' (resto)', createdAt: Date.now(), status: 'open',
            items: unchecked.map((it) => ({ articleId: it.articleId, qty: it.qty, checked: false })),
          });
        }
        close();
        await load();
        storicoTab = 'spese';
        toast('Spesa registrata ✓');
        location.hash = '#/storico';
      },
    },
  ]);
}

/* ───────────── VISTA: articoli e categorie ───────────── */
let artQuery = '';
function viewArticoli() {
  const wrap = h('section', {}, pageHead('Articoli'));
  const chips = h('div', { class: 'chips' },
    state.categories.map((c) =>
      h('button', { class: 'chip', type: 'button', onclick: () => categorySheet(c) },
        c.name, h('small', {}, state.articles.filter((a) => a.categoryId === c.id).length))),
    h('button', { class: 'chip add', type: 'button', onclick: () => categorySheet(null) }, '+ Categoria'));
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Cerca tra gli articoli…', value: artQuery, autocomplete: 'off' });
  const box = h('div', { class: 'stack tight' });

  const draw = () => {
    const q = norm(artQuery);
    const arts = state.articles.filter((a) => !q || norm(a.name).includes(q));
    const groups = new Map();
    for (const a of arts) {
      const k = state.categories.some((c) => c.id === a.categoryId) ? a.categoryId : null;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(a);
    }
    const order = [...state.categories.map((c) => c.id), null].filter((k) => groups.has(k));
    if (!order.length) {
      box.replaceChildren(empty(state.articles.length ? 'Nessun risultato' : 'Nessun articolo', state.articles.length ? 'Prova con un altro nome.' : 'Tocca + per aggiungere il primo articolo.'));
      return;
    }
    box.replaceChildren(...order.map((k) =>
      h('div', { class: 'group' },
        h('h3', {}, k == null ? 'Senza categoria' : catName(k)),
        groups.get(k).sort(byName).map((a) =>
          h('button', { class: 'row-btn', type: 'button', onclick: () => articleSheet(a) }, h('span', {}, a.name), icon('edit'))))));
  };
  search.addEventListener('input', () => { artQuery = search.value; draw(); });
  draw();
  wrap.append(chips, search, box, fab(() => articleSheet(null), 'Nuovo articolo'));
  return wrap;
}

function articleSheet(a) {
  const name = h('input', { class: 'input', value: a?.name ?? '', placeholder: 'Nome articolo', maxlength: 80 });
  const sel = categorySelect(a ? a.categoryId : Number(prefs.get('newCat', '')) || null);
  const actions = [];
  if (a) {
    actions.push({
      label: 'Elimina', cls: 'danger',
      run: async (close) => {
        close();
        if (!(await confirmBox('Eliminare l’articolo?', `"${a.name}" sarà rimosso dall’elenco e dalle liste aperte. Lo storico degli acquisti resta.`, 'Elimina', true))) return;
        await db.del('articles', a.id);
        for (const l of state.lists.filter((l) => l.status === 'open' && l.items.some((i) => i.articleId === a.id))) {
          l.items = l.items.filter((i) => i.articleId !== a.id);
          await db.put('lists', l);
        }
        await load(); render();
      },
    });
  }
  actions.push({ label: 'Annulla', cls: 'ghost', run: (c) => c() });
  actions.push({
    label: 'Salva', cls: 'primary',
    run: async (close) => {
      const n = cap(name.value.trim());
      if (!n) { toast('Inserisci un nome'); return; }
      const dup = state.articles.find((x) => norm(x.name) === norm(n) && x.id !== a?.id);
      if (dup) { toast('Esiste già un articolo con questo nome'); return; }
      await db.put('articles', { ...(a || {}), name: n, categoryId: Number(sel.value) || null });
      if (!a) prefs.set('newCat', sel.value);
      close(); await load(); render();
    },
  });
  openSheet(a ? 'Modifica articolo' : 'Nuovo articolo', [
    h('label', { class: 'lbl' }, 'Nome'), name, h('label', { class: 'lbl' }, 'Categoria'), sel,
  ], actions);
  if (!a) setTimeout(() => name.focus(), 60);
}

function categorySheet(c) {
  const name = h('input', { class: 'input', value: c?.name ?? '', placeholder: 'Nome categoria', maxlength: 40 });
  const move = async (dir, close) => {
    const arr = [...state.categories];
    const i = arr.findIndex((x) => x.id === c.id);
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    for (const [idx, cat] of arr.entries()) await db.put('categories', { ...cat, order: idx + 1 });
    close(); await load(); render();
  };
  const actions = [];
  if (c) {
    actions.push({
      label: 'Elimina', cls: 'danger',
      run: async (close) => {
        close();
        const n = state.articles.filter((a) => a.categoryId === c.id).length;
        const msg = n ? `I ${n} articoli di "${c.name}" resteranno disponibili come “Senza categoria”.` : `"${c.name}" sarà eliminata.`;
        if (!(await confirmBox('Eliminare la categoria?', msg, 'Elimina', true))) return;
        for (const a of state.articles.filter((a) => a.categoryId === c.id)) await db.put('articles', { ...a, categoryId: null });
        await db.del('categories', c.id);
        await load(); render();
      },
    });
  }
  actions.push({ label: 'Annulla', cls: 'ghost', run: (cl) => cl() });
  actions.push({
    label: 'Salva', cls: 'primary',
    run: async (close) => {
      const n = name.value.trim();
      if (!n) { toast('Inserisci un nome'); return; }
      if (state.categories.some((x) => norm(x.name) === norm(n) && x.id !== c?.id)) { toast('Categoria già esistente'); return; }
      const order = c ? c.order : Math.max(0, ...state.categories.map((x) => x.order ?? 0)) + 1;
      await db.put('categories', { ...(c || {}), name: n, order });
      close(); await load(); render();
    },
  });
  const body = [h('label', { class: 'lbl' }, 'Nome'), name];
  if (c) {
    body.push(
      h('label', { class: 'lbl' }, 'Posizione (ordine dei reparti nelle liste)'),
      h('div', { class: 'moves' },
        h('button', { class: 'btn ghost', type: 'button', onclick: (e) => move(-1, () => e.target.closest('dialog').close()) }, '↑ Su'),
        h('button', { class: 'btn ghost', type: 'button', onclick: (e) => move(1, () => e.target.closest('dialog').close()) }, '↓ Giù')));
  }
  openSheet(c ? 'Modifica categoria' : 'Nuova categoria', body, actions);
}

/* ───────────── VISTA: storico (ricorrenza + spese) ───────────── */
let storicoTab = 'ricorrenza';
let statSort = 'count';
let statQuery = '';
const expanded = new Set();

function computeStats() {
  const today = todayISO();
  const map = new Map();
  for (const p of state.purchases) {
    for (const it of p.items) {
      const key = it.articleId ?? 'n:' + norm(it.name);
      let s = map.get(key);
      if (!s) { s = { key, articleId: it.articleId, name: it.name, cat: it.categoryName, purchases: new Set(), dates: new Set(), pieces: 0 }; map.set(key, s); }
      s.purchases.add(p.id);
      s.dates.add(p.date);
      s.pieces += it.qty || 1;
    }
  }
  return [...map.values()].map((s) => {
    const art = s.articleId != null ? artById(s.articleId) : null;
    const dates = [...s.dates].sort();
    const last = dates[dates.length - 1];
    const avg = dates.length > 1 ? daysBetween(dates[0], last) / (dates.length - 1) : null;
    const since = daysBetween(last, today);
    return {
      name: art?.name ?? s.name,
      cat: art ? catName(art.categoryId) : s.cat,
      count: s.purchases.size, pieces: s.pieces, last, since, avg,
      due: avg != null ? avg - since : null,
    };
  });
}

function viewStorico() {
  const wrap = h('section', {}, pageHead('Storico'));
  wrap.append(segmented([['ricorrenza', 'Ricorrenza'], ['spese', 'Spese']], storicoTab, (v) => { storicoTab = v; render(); }));
  if (!state.purchases.length) {
    wrap.append(empty('Ancora nessuna spesa', 'Quando concludi una lista, la spesa viene registrata qui e potrai vedere ogni quanto compri ciascun articolo.'));
    return wrap;
  }
  wrap.append(storicoTab === 'ricorrenza' ? panelRicorrenza() : panelSpese());
  return wrap;
}

function panelRicorrenza() {
  const box = h('div', { class: 'stack tight' });
  const sort = h('select', { class: 'input slim', onchange: (e) => { statSort = e.target.value; draw(); } },
    [['count', 'Più acquistati'], ['due', 'Prossimo acquisto'], ['recent', 'Acquistati di recente'], ['name', 'Nome A–Z']]
      .map(([v, l]) => h('option', { value: v, selected: v === statSort }, l)));
  const search = h('input', { class: 'input slim', type: 'search', placeholder: 'Cerca…', value: statQuery, oninput: (e) => { statQuery = e.target.value; draw(); } });
  const stats = computeStats();

  const draw = () => {
    const q = norm(statQuery);
    const rows = stats.filter((s) => !q || norm(s.name).includes(q));
    rows.sort({
      count: (a, b) => b.count - a.count || byName(a, b),
      due: (a, b) => (a.due ?? 1e9) - (b.due ?? 1e9) || byName(a, b),
      recent: (a, b) => a.since - b.since || byName(a, b),
      name: byName,
    }[statSort]);
    if (!rows.length) { box.replaceChildren(empty('Nessun risultato', 'Prova con un altro nome.')); return; }
    box.replaceChildren(...rows.map((s) => {
      let badge = null;
      if (s.due != null) {
        const late = s.due < -0.5;
        const label = Math.abs(s.due) < 0.5 ? 'Da ricomprare ora' : late ? `In ritardo di ${dur(-s.due)}` : `Tra ${dur(s.due)}`;
        badge = h('span', { class: 'badge ' + (late ? 'late' : s.due <= 2 ? 'soon' : '') }, label);
      }
      return h('div', { class: 'card stat' },
        h('div', { class: 'row' },
          h('div', {}, h('strong', {}, s.name), h('small', { class: 'muted block' }, s.cat)),
          h('span', { class: 'pill' }, `${s.count}×`)),
        h('div', { class: 'meta' },
          h('span', {}, 'Ultimo acquisto: ', h('b', {}, ago(s.since))),
          h('span', {}, s.avg != null ? ['Ricorrenza: ogni ', h('b', {}, '~' + dur(s.avg))] : 'Ricorrenza: servono 2 acquisti in giorni diversi'),
          s.pieces !== s.count ? h('span', {}, `Pezzi totali: ${s.pieces}`) : null),
        badge);
    }));
  };
  draw();
  return h('div', {}, h('div', { class: 'filters' }, search, sort), box);
}

function panelSpese() {
  const list = [...state.purchases].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const month = todayISO().slice(0, 7);
  const monthTotal = list.filter((p) => p.date.startsWith(month)).reduce((s, p) => s + (p.total || 0), 0);
  const nMonth = list.filter((p) => p.date.startsWith(month)).length;
  const box = h('div', { class: 'stack tight' });
  box.append(h('div', { class: 'card summary' },
    h('small', { class: 'muted' }, 'Questo mese'),
    h('div', { class: 'big' }, monthTotal ? money(monthTotal) : '—'),
    h('small', { class: 'muted' }, `${nMonth} ${nMonth === 1 ? 'spesa' : 'spese'}`)));
  for (const p of list) {
    const open = expanded.has(p.id);
    box.append(h('div', { class: 'card purchase' + (open ? ' open' : '') },
      h('button', { class: 'row-btn plain', type: 'button', onclick: () => { open ? expanded.delete(p.id) : expanded.add(p.id); render(); } },
        h('div', {}, h('strong', {}, cap(fmtDate(p.date))), h('small', { class: 'muted block' }, `${p.listName || 'Spesa'} · ${p.items.length} articoli`)),
        h('span', { class: 'pill' }, p.total != null ? money(p.total) : '—')),
      open ? h('div', { class: 'detail' },
        p.items.map((it) => h('div', { class: 'line' },
          h('span', {}, it.name, it.qty > 1 ? ` ×${it.qty}` : ''), h('span', { class: 'muted' }, it.price != null ? money(it.price) : ''))),
        h('button', {
          class: 'btn danger sm', type: 'button',
          onclick: async () => {
            if (!(await confirmBox('Eliminare la spesa?', 'Verrà rimossa dallo storico e dalle statistiche di ricorrenza.', 'Elimina', true))) return;
            await db.del('purchases', p.id); expanded.delete(p.id); await load(); render();
          },
        }, 'Elimina spesa')) : null));
  }
  return box;
}

/* ───────────── VISTA: impostazioni ───────────── */
let installPrompt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; if (currentPage() === 'impostazioni') render(); });
addEventListener('appinstalled', () => { installPrompt = null; if (currentPage() === 'impostazioni') render(); });

function viewImpostazioni() {
  const wrap = h('section', {}, pageHead('Impostazioni'));
  const theme = prefs.get('theme', 'auto');
  const hue = prefs.get('hue', '262');
  const persistLabel = h('small', { class: 'muted' }, 'Verifica in corso…');

  navigator.storage?.persisted?.().then((p) => {
    persistLabel.textContent = p ? 'Archiviazione protetta: Android non cancellerà i dati automaticamente.' : 'Archiviazione non protetta: in caso di poco spazio Android potrebbe liberare i dati del sito.';
  }).catch(() => { persistLabel.textContent = ''; });

  const lastBackup = prefs.get('lastBackup', '');
  wrap.append(
    h('div', { class: 'card stack tight' },
      h('h3', {}, 'Aspetto'),
      segmented([['auto', 'Automatico'], ['light', 'Chiaro'], ['dark', 'Scuro']], theme, (v) => { prefs.set('theme', v); applyPrefs(); render(); }),
      h('label', { class: 'lbl' }, 'Colore'),
      h('div', { class: 'swatches' },
        HUES.map(([n, v]) => h('button', {
          class: 'sw' + (String(v) === hue ? ' on' : ''), type: 'button', 'aria-label': n, title: n,
          style: `--sw:${v}`, onclick: () => { prefs.set('hue', String(v)); applyPrefs(); render(); },
        })))),
    h('div', { class: 'card stack tight' },
      h('h3', {}, 'Backup dei dati'),
      h('p', { class: 'muted' }, 'I dati stanno solo su questo telefono. Se disinstalli l’app o cancelli i dati di Chrome, vengono persi: fai ogni tanto un backup.'),
      h('small', { class: 'muted' }, lastBackup ? `Ultimo backup: ${fmtDate(lastBackup)}` : 'Nessun backup ancora eseguito.'),
      h('div', { class: 'moves' },
        h('button', { class: 'btn primary', type: 'button', onclick: doExport }, 'Esporta'),
        h('button', { class: 'btn ghost', type: 'button', onclick: doImport }, 'Importa')),
      persistLabel,
      h('button', {
        class: 'btn ghost', type: 'button',
        onclick: async () => {
          const ok = await navigator.storage?.persist?.();
          toast(ok ? 'Archiviazione protetta ✓' : 'Il browser non ha concesso la protezione');
          render();
        },
      }, 'Proteggi i dati dalla pulizia automatica')),
    h('div', { class: 'card stack tight' },
      h('h3', {}, 'App'),
      installPrompt
        ? h('button', { class: 'btn primary', type: 'button', onclick: async () => { installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; render(); } }, 'Installa sulla schermata Home')
        : h('p', { class: 'muted' }, matchMedia('(display-mode: standalone)').matches ? 'App installata.' : 'Per installarla: menu di Chrome (⋮) → “Installa app” o “Aggiungi a schermata Home”.'),
      h('button', {
        class: 'btn danger', type: 'button',
        onclick: async () => {
          if (!(await confirmBox('Cancellare tutti i dati?', 'Liste, articoli, categorie e storico verranno eliminati definitivamente. Esporta prima un backup se ti servono.', 'Cancella tutto', true))) return;
          await db.wipe(); await load(); await seed(); location.hash = '#/liste'; toast('Dati cancellati');
        },
      }, 'Cancella tutti i dati'))
  );
  return wrap;
}

async function doExport() {
  const data = await db.exportAll();
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  const a = h('a', { href: url, download: `spesa-backup-${todayISO()}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  prefs.set('lastBackup', todayISO());
  toast('Backup esportato');
  render();
}

function doImport() {
  const input = h('input', { type: 'file', accept: '.json,application/json', class: 'hidden' });
  input.addEventListener('change', async () => {
    const file = input.files[0];
    input.remove();
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!(await confirmBox('Importare il backup?', 'I dati attuali verranno sostituiti con quelli del file.', 'Importa', true))) return;
      await db.importAll(data);
      await load();
      toast('Backup importato ✓');
      location.hash = '#/liste';
      render();
    } catch (err) {
      toast(err.message || 'File non valido');
    }
  });
  document.body.append(input);
  input.click();
}

/* ───────────── router ───────────── */
const NAV = [['liste', 'Liste', 'list'], ['articoli', 'Articoli', 'tag'], ['storico', 'Storico', 'chart'], ['impostazioni', 'Impost.', 'gear']];
const parseHash = () => {
  const [page = 'liste', arg] = location.hash.replace(/^#\/?/, '').split('/');
  return { page: NAV.some((n) => n[0] === page) ? page : 'liste', arg };
};
const currentPage = () => parseHash().page;

let lastKey = '';
function render() {
  const { page, arg } = parseHash();
  const key = location.hash;
  const y = key === lastKey ? scrollY : 0;
  let node;
  if (page === 'liste' && arg) node = viewLista(Number(arg));
  else if (page === 'liste') node = viewListe();
  else if (page === 'articoli') node = viewArticoli();
  else if (page === 'storico') node = viewStorico();
  else node = viewImpostazioni();
  $('#main').replaceChildren(node);
  for (const a of document.querySelectorAll('#nav a')) a.classList.toggle('on', a.dataset.page === page);
  lastKey = key;
  scrollTo(0, y);
}

async function init() {
  applyPrefs();
  $('#nav').append(...NAV.map(([p, label, ic]) => h('a', { href: '#/' + p, 'data-page': p }, icon(ic), h('span', {}, label))));
  addEventListener('hashchange', render);
  try {
    await load();
    await seed();
  } catch (err) {
    $('#main').replaceChildren(empty('Database non disponibile', 'Il browser non permette l’archiviazione locale (navigazione in incognito?).'));
    return;
  }
  render();
  navigator.storage?.persist?.().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
init();
