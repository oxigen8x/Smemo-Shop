# Lista della Spesa (PWA offline)

App per gestire liste della spesa, articoli, categorie e storico acquisti con ricorrenza.
Funziona offline e i dati restano sul telefono (IndexedDB). Nessun server, nessun account.

## Pubblicare su GitHub Pages

1. Copia tutti i file di questa cartella nella radice del tuo repository (compresa la cartella `icons/` e il file nascosto `.nojekyll`).
2. Commit e push:
   ```bash
   git add .
   git commit -m "Lista della spesa PWA"
   git push
   ```
3. Su GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, scegli `main` e la cartella `/ (root)`, poi Save.
4. Dopo circa un minuto l'app è su `https://<utente>.github.io/<repo>/`.

## Installare su Android

1. Apri l'indirizzo in **Chrome** sul telefono (la prima volta serve la connessione).
2. Menu ⋮ → **Installa app** (o "Aggiungi a schermata Home"), oppure Impostazioni dell'app → "Installa sulla schermata Home".
3. Da quel momento si apre come un'app normale e funziona anche senza rete.

## Uso rapido

- **Articoli** (catalogo): qui si creano e modificano gli articoli, ognuno con la sua icona (emoji) e categoria. All'inizio trovi già circa 90 articoli generici (latte, pane, acqua…). Puoi vederli a riquadri o a elenco con i due pulsanti in alto.
- **Liste**: crea una lista e scegli gli articoli **dal catalogo** (non si creano da qui). Poi spunta mentre fai la spesa.
- **Concludi spesa**: registra data, totale e, se vuoi, gli importi per articolo. Gli articoli non presi possono passare in una nuova lista.
- **Scansione scontrino** (funziona offline, la foto resta sul telefono):
  - in *Articoli* → "Crea articoli da uno scontrino": legge le righe, riconosce quelle già presenti e propone di creare le altre (nome, icona e categoria modificabili);
  - in *Concludi spesa* → "Scansiona scontrino": legge totale e importi e li compila per gli articoli della lista; puoi correggere gli abbinamenti.
  - L'app ricorda gli abbinamenti che confermi (es. "LATTE PS INT 1L" = Latte), quindi le volte successive sbaglia meno.
  - Consigli: scontrino ben disteso, buona luce, niente ombre, inquadrato in verticale e intero. Se qualche riga non viene letta bene, correggi nella schermata di verifica.
- **Categorie**: tocca una categoria in *Articoli* per rinominarla, cambiarne l'icona o spostarla. L'ordine è quello con cui compaiono nelle liste (mettilo come i reparti del tuo supermercato).
- **Storico → Ricorrenza**: per ogni articolo quante volte lo hai comprato, quando l'ultima volta, ogni quanto lo compri in media e quando ti servirà di nuovo.
- **Storico → Spese**: elenco delle spese con dettaglio e totale del mese.

## Backup (importante)

I dati sono solo nel browser del telefono. Se disinstalli Chrome o cancelli i "dati del sito", si perdono.
Vai in **Impostazioni → Esporta** ogni tanto e conserva il file `.json` (Drive, email, ecc.). **Importa** lo ripristina.
L'app chiede anche ad Android di proteggere i dati dalla pulizia automatica.

## Aggiornare l'app

Dopo un push, apri l'app online: scarica la nuova versione in background e la mostra alla riapertura successiva.
Se aggiungi file nuovi, ricordati di inserirli nell'elenco `ASSETS` in `sw.js` e di cambiare il nome della cache (`CACHE`, es. `spesa-v3`).
I dati esistenti restano: all'aggiornamento il database viene migrato da solo e il catalogo di base viene aggiunto una volta (non tocca i tuoi articoli).
Da Impostazioni puoi rimettere in qualsiasi momento gli articoli di base mancanti.

Nota: la scansione dello scontrino include il motore OCR (circa 6 MB scaricati alla prima installazione, 9 MB nel repository).

## Sviluppo in locale

```bash
python3 -m http.server 8000
```
poi apri http://localhost:8000 (il service worker funziona su localhost).

## File

- `index.html`, `styles.css`: interfaccia e tema
- `app.js`: viste e logica; `db.js`: accesso a IndexedDB
- `catalog.js`: articoli di base, icone e sinonimi; `scan.js`: OCR, lettura righe e abbinamento
- `vendor/tesseract/`: motore OCR (Tesseract.js, Apache-2.0) e dati lingua italiana
- `sw.js`, `manifest.webmanifest`, `icons/`: parte PWA/offline
