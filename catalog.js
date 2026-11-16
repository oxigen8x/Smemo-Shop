// Catalogo di base: categorie, articoli generici con icona (emoji) e sinonimi per riconoscere
// i nomi abbreviati degli scontrini. Le emoji sono limitate a Unicode ≤ 12 per essere visibili su tutti gli Android recenti.

export const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** [categoria, icona categoria, [[articolo, icona, [sinonimi…]], …]] */
export const CATALOG = [
  ['Frutta e verdura', '🥬', [
    ['Mele', '🍎'], ['Pere', '🍐'], ['Banane', '🍌'], ['Arance', '🍊', ['arancia', 'clementine', 'mandarini']],
    ['Limoni', '🍋'], ['Uva', '🍇'], ['Fragole', '🍓'], ['Pesche', '🍑'], ['Meloni', '🍈'], ['Anguria', '🍉', ['cocomero']],
    ['Pomodori', '🍅', ['pomodorini', 'datterini', 'ciliegino']], ['Insalata', '🥬', ['lattuga', 'rucola', 'valeriana']],
    ['Carote', '🥕'], ['Patate', '🥔'], ['Cipolle', '🧅'], ['Aglio', '🧄'], ['Zucchine', '🥒', ['cetrioli']],
    ['Peperoni', '🌶️'], ['Melanzane', '🍆'], ['Funghi', '🍄'], ['Broccoli', '🥦', ['cavolfiore']], ['Mais', '🌽'], ['Avocado', '🥑'],
  ]],
  ['Pane e panetteria', '🥖', [
    ['Pane', '🍞', ['pagnotta', 'filone', 'pancarre']], ['Panini', '🥖', ['baguette', 'rosetta', 'ciabatta']],
    ['Croissant', '🥐', ['brioche', 'cornetto']], ['Fette biscottate', '🍞'], ['Grissini', '🥖', ['crackers', 'taralli']],
    ['Pizza', '🍕', ['focaccia']],
  ]],
  ['Latticini e uova', '🥛', [
    ['Latte', '🥛'], ['Yogurt', '🥣', ['yog', 'yoghurt']], ['Burro', '🧈'], ['Uova', '🥚'], ['Mozzarella', '🧀', ['mozz', 'bufala']],
    ['Parmigiano', '🧀', ['grana', 'parmigiano reggiano', 'pecorino']], ['Formaggio', '🧀', ['fontina', 'asiago', 'provola', 'sottilette', 'stracchino']],
    ['Ricotta', '🧀'], ['Panna', '🥛'],
  ]],
  ['Carne e pesce', '🥩', [
    ['Pollo', '🍗', ['petto', 'cosce']], ['Carne macinata', '🥩', ['macinato', 'hamburger']], ['Bistecche', '🥩', ['fettine', 'manzo', 'vitello', 'maiale']],
    ['Salsicce', '🌭', ['wurstel']], ['Prosciutto', '🥓', ['crudo', 'cotto', 'speck', 'mortadella', 'salame', 'bresaola', 'affettato']],
    ['Tonno', '🐟', ['tonno in scatola']], ['Salmone', '🐟'], ['Merluzzo', '🐟', ['pesce', 'orata', 'branzino', 'platessa']], ['Gamberi', '🦐'],
  ]],
  ['Dispensa', '🥫', [
    ['Pasta', '🍝', ['spaghetti', 'penne', 'fusilli', 'rigatoni', 'tagliatelle', 'farfalle', 'maccheroni', 'tortellini']],
    ['Riso', '🍚'], ['Farina', '🌾'], ['Zucchero', '🍬'], ['Sale', '🧂'], ['Olio', '🍾', ['olio extravergine', 'olio di semi']], ['Aceto', '🍶'],
    ['Passata di pomodoro', '🥫', ['passata', 'pelati', 'polpa']], ['Legumi', '🌱', ['fagioli', 'ceci', 'lenticchie']],
    ['Biscotti', '🍪', ['merendine', 'wafer']], ['Cereali', '🥣', ['muesli', 'corn flakes']], ['Caffè', '☕', ['caffe', 'capsule']],
    ['Tè', '🍵', ['te', 'tisana', 'camomilla']], ['Marmellata', '🍯', ['confettura', 'miele']], ['Cioccolato', '🍫', ['nutella', 'cioccolata']],
    ['Maionese', '🥫', ['ketchup', 'senape']], ['Frutta secca', '🥜', ['noci', 'mandorle', 'arachidi', 'nocciole']],
  ]],
  ['Surgelati', '🧊', [
    ['Verdure surgelate', '🥦', ['minestrone surgelato', 'spinaci surgelati']], ['Piselli surgelati', '🌱'], ['Pizza surgelata', '🍕'],
    ['Gelato', '🍦'], ['Patatine surgelate', '🍟'], ['Bastoncini di pesce', '🐟'],
  ]],
  ['Bevande', '🥤', [
    ['Acqua', '💧', ['acqua minerale', 'naturale']], ['Acqua frizzante', '💦', ['gasata']], ['Succo di frutta', '🧃', ['succo', 'spremuta']],
    ['Bibita gassata', '🥤', ['cola', 'aranciata', 'limonata', 'fanta', 'sprite']], ['Birra', '🍺'], ['Vino', '🍷', ['prosecco', 'spumante']],
    ['Latte vegetale', '🥛', ['soia', 'avena', 'mandorla']],
  ]],
  ['Casa e igiene', '🧻', [
    ['Carta igienica', '🧻'], ['Carta da cucina', '🧻', ['rotoli', 'scottex', 'asciugatutto']], ['Fazzoletti', '🧻'],
    ['Detersivo piatti', '🧴', ['svelto', 'lavapiatti']], ['Detersivo lavatrice', '🧺', ['bucato']], ['Ammorbidente', '🧴'],
    ['Sapone', '🧼', ['bagnoschiuma', 'docciaschiuma']], ['Shampoo', '🧴', ['balsamo']], ['Dentifricio', '🦷', ['spazzolino', 'collutorio']],
    ['Sacchetti spazzatura', '🗑️', ['sacchi', 'immondizia']], ['Spugne', '🧽', ['panni']], ['Candeggina', '🧪', ['anticalcare', 'sgrassatore', 'pulitore']],
  ]],
  ['Altro', '🛒', [
    ['Cibo per animali', '🐾', ['crocchette', 'cane', 'gatto', 'lettiera']], ['Batterie', '🔋', ['pile']], ['Lampadine', '💡'],
  ]],
];

/** Icone predefinite delle categorie, indicizzate per nome normalizzato. */
export const CAT_ICON = Object.fromEntries(CATALOG.map(([name, icon]) => [norm(name), icon]));

/** Selezione di emoji tra cui scegliere (cibo, casa, varie). */
export const EMOJI_PICKER = [
  '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍑', '🍒', '🍍', '🥭', '🥝', '🍅', '🥑', '🍆', '🥔', '🥕', '🌽',
  '🌶️', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄', '🥜', '🌰', '🍞', '🥐', '🥖', '🥨', '🥯', '🥞', '🧇', '🧀', '🥚', '🍳', '🧈',
  '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🌮', '🌯', '🥗', '🥘', '🍝', '🍜', '🍲', '🍛', '🍣', '🍤', '🐟', '🦐',
  '🍚', '🌾', '🥫', '🍱', '🍿', '🧂', '🍫', '🍬', '🍭', '🍪', '🍩', '🍰', '🧁', '🍦', '🍯', '🥛', '☕', '🍵', '🧃', '🥤',
  '💧', '💦', '🍺', '🍻', '🍷', '🥂', '🍾', '🍶', '🥣', '🌱', '🧊', '🧻', '🧴', '🧼', '🧽', '🧺', '🧹', '🗑️', '🧪', '🦷',
  '💡', '🔋', '🐾', '🐶', '🐱', '👶', '💊', '🩹', '🕯️', '🎁', '✏️', '📦', '🛒', '🏷️',
];

// Indice per indovinare icona/categoria dal nome (anche abbreviato) di un articolo.
const INDEX = [];
for (const [cat, catIcon, items] of CATALOG) {
  for (const [name, icon, syn = []] of items) {
    INDEX.push({ name, cat, icon: icon || catIcon, keys: [name, ...syn].map((k) => norm(k).split(/[^a-z]+/).filter(Boolean)) });
  }
}

/**
 * Cerca nel catalogo l'articolo che meglio corrisponde a un nome libero.
 * Restituisce { name, cat, icon } oppure null.
 */
export function guess(text) {
  const toks = norm(text).split(/[^a-z]+/).filter((t) => t.length >= 2);
  if (!toks.length) return null;
  let best = null;
  for (const e of INDEX) {
    for (const key of e.keys) {
      // tutte le parole della chiave devono comparire (come prefisso/uguaglianza) nel testo
      const hit = key.every((k) => toks.some((t) => t === k || (k.length >= 4 && t.length >= 4 && (t.startsWith(k) || k.startsWith(t)))));
      if (!hit) continue;
      const score = key.length * 10 + key.join('').length;
      if (!best || score > best.score) best = { score, name: e.name, cat: e.cat, icon: e.icon };
    }
  }
  return best && { name: best.name, cat: best.cat, icon: best.icon };
}
