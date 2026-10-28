FUORI MAPPA — Pacchetto HTML revisionato — 28 ottobre 2026

I file sono nominati come devono essere nel repository GitHub Pages (es. uzbekistan.html, non uzbekistan(2).html).

REVISIONI
- Navigazione uniforme nei principali file pubblici: Home, Itinerari, Servizi, Dove dormire, Chi sono & Passaporto, Costruiamo il tuo viaggio.
- Collegamenti ai menu obsoleti Viaggi vissuti / Viaggi da vivere rimossi dalla navigazione, senza cancellare i contenuti editoriali degli itinerari.
- Responsive in tre contesti: desktop, browser smartphone, app PWA installata. Funzioni di account, preferiti e passaporto non sono state riscritte.
- Google Analytics 4 G-Y8EQGCQFHQ usa le stesse preferenze e lo stesso banner della homepage. Nessuno script di Google Analytics viene caricato prima del consenso statistico.
- Pagine private/tecniche lasciate intatte: il-mio-spazio.html, recupera-password.html, offline.html, googlecdcd33d0356df71a.html, template-viaggio-definitivo.html; privacy e termini già aggiornati restano invariati.
- Homepage index.html conservata nella versione aggiornata ricevuta. La pagina itinerari.html mantiene il menu originale per non compromettere filtri e preferiti, e ora ha anche il consenso Analytics.

ISTRUZIONI
1. Conservare una copia di backup del repository.
2. Caricare nella radice del repository i file HTML aggiornati, sovrascrivendo i file con lo stesso nome. Non caricare la cartella README se si desidera solo aggiornare le pagine.
3. Le immagini e gli asset CSS/JS originali non sono inclusi nel pacchetto: devono restare sul repository.
4. Verificare dopo la pubblicazione da PC, smartphone browser e app installata; in app PWA chiudere e riaprire l'app per aggiornare eventuali cache del service worker.
5. Verificare Analytics in tempo reale solo dopo aver accettato le statistiche. Per rifiutarle usare Preferenze cookie.

NOTA: la presenza del codice Analytics e del banner non è da sola garanzia di piena conformità legale. Verificare anche impostazioni Google e informativa privacy con un professionista.

LIMITI DEL CONTROLLO
- I file delle fotografie non erano inclusi negli allegati: non è possibile confermarne la presenza sul server. Da verificare in particolare giordania.html (sfondo hero: georgia-hero.png) e montenegro.html (sfondo hero: croazia-hero.png), già così nei file originali. Non sono stati sostituiti con immagini inesistenti.
- Non è stato possibile completare una prova visuale automatica su browser, a causa del blocco della navigazione locale nell’ambiente di test. I collegamenti HTML interni e la sintassi degli script sono stati controllati staticamente con esito positivo.
- Su un sito in produzione, verificare navigazione e consenso effettivi prima di considerare la revisione pubblicata definitivamente.
