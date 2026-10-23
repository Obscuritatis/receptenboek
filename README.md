# Mijn Receptenboek

Een persoonlijke receptenapp die in de browser werkt en als app op je gsm, tablet of computer geïnstalleerd kan worden (PWA).

**Openen:** https://obscuritatis.github.io/receptenboek/

## Wat kan het
- Recepten per categorie (Desserts, Voorgerechten, Soepen, …); categorieën zijn aan te passen, te herordenen en uit te breiden.
- Recept toevoegen met ingrediënten, bereidingsstappen, tijden, personen, tips, bron en foto.
- Hoeveelheden herberekenen voor meer of minder personen.
- Ingrediënten afvinken en stappen markeren tijdens het koken, scherm aan houden, recept afdrukken.
- Zoeken op naam of ingrediënt, favorieten.
- Back-up downloaden en terugzetten (JSON), ook handig om recepten naar een ander toestel over te zetten.
- Werkt offline na het eerste bezoek.

## Installeren als app
- **Android / Chrome:** menu ⋮ → *App installeren* (of *Toevoegen aan startscherm*).
- **iPhone / iPad (Safari):** deelknop → *Zet op beginscherm*.
- **Computer (Chrome/Edge):** installeer-icoon rechts in de adresbalk.

## Gegevens
Recepten worden lokaal op het toestel bewaard (IndexedDB). Er is geen server of account.

## Techniek
Statische site zonder build-stap: `index.html`, `styles.css`, `app.js`, `sw.js` (service worker) en `manifest.webmanifest`. Gehost via GitHub Pages vanaf de `main`-branch.
