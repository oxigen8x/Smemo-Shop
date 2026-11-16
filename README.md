# Smemo

App offline per la lista della spesa (PWA per Android). Tutti i dati restano sul telefono (IndexedDB).

## Funzioni
- Catalogo articoli con icone (vista elenco o riquadri), ~90 articoli di base già inclusi
- Più liste attive, con check per articolo e quantità in pezzi; si aggiungono solo articoli del catalogo
- Conclusione lista: registra la spesa (data, totale, importi per articolo)
- Storico con ricorrenza per articolo: volte acquistato, ultimo acquisto, intervallo medio, prossimo stimato
- Scansione scontrino offline (OCR Tesseract incluso, nessuna rete):
  - **Fotocamera dinamica**: scorri lungo lo scontrino, le righe vengono lette e unite da sole
  - **A sezioni**: scatti una parte alla volta (se la dinamica non va bene)
  - **Galleria**: scegli una o più foto
  - Gli abbinamenti corretti vengono ricordati per le scansioni successive
- Tema chiaro/scuro/auto, colore d'accento a scelta (il logo lo segue)
- Backup/ripristino JSON

## Pubblicare su GitHub Pages
1. Copia tutti i file di questa cartella nella radice del repo (mantieni `.nojekyll`).
2. Commit e push.
3. Repo → Settings → Pages → Deploy from a branch → `main` / root.
4. Apri `https://TUOUTENTE.github.io/NOMEREPO/` da Chrome su Android → menu → "Installa app".

La prima apertura deve avvenire online: vengono salvati in cache anche i file OCR (~9 MB). Dopo funziona tutto offline.

## Aggiornamenti
Dopo ogni modifica incrementa `CACHE` in `sw.js` (ora `smemo-v3`), altrimenti il telefono continua a usare la versione vecchia.

## Note
- Il database interno si chiama ancora `spesa` per non perdere i dati di chi usava la versione precedente.
- L'icona nel launcher di Android è fissa (viola); logo in-app e favicon seguono il colore scelto.
- Se una scansione sbaglia, apri "Testo letto dalla foto" nella schermata di revisione per vedere cosa ha letto l'OCR.
- Le soglie della scansione dinamica sono tarate su test sintetici: potrebbero richiedere ritocchi con scontrini reali.
