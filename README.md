# Kungsbacka Car Community — hemsida

Statisk ensidesajt (`index.html` + `assets/` + `data/`) för Kungsbacka Car Community.
Deployas via **cPanel Git Version Control** från detta repo:
<https://github.com/SebMcCayen/kungsbacka-car-community-homepage>

Designen är helvit med guldaccenter (`#ecb44c` / `#c9922e`), typsnitten RobotoSlab +
SourceSans, och sektionerna Hero → Om oss → Event → Webshop → Samarbeten → Bli medlem →
Footer. Parallax-glow, scroll-animationer och en levande nedräkning till nästa träff.

## Filstruktur

| Sökväg | Beskrivning |
| --- | --- |
| `index.html` | Hela sidan (HTML/CSS/JS, inga byggsteg). |
| `assets/` | Logotyper, typsnitt och webshop-bilder. |
| `data/app-events.json` | Kommande event (skrivs automatiskt av appens backend, se nedan). |
| `data/instagram.json` | Instagram-flöde (fylls av GitHub Action, se nedan). |
| `.github/workflows/instagram.yml` | Schemalagt Instagram-hämtning. |
| `scripts/fetch_instagram.py` | Hämtscriptet (Instaloader). |
| `.cpanel.yml` | Deploy-instruktioner för cPanel. |

## Dynamiskt innehåll

### Event (från appen)
Eventen publiceras från Kungsbacka Car Community-appen: appens backend skriver
**`data/app-events.json`** automatiskt — redigera INTE filen för hand, ändringar
skrivs över. Sidan visar upp till sex kommande eller pågående event, sorterade efter
starttid. Nedräkningen pekar på nästa framtida start (även om andra event pågår).
Saknas filen eller är listan tom visas ett
tomt läge ("Garaget är tyst just nu…") — sektionen går aldrig sönder av en trasig fil.

Fält per event: `title`, `date` (ÅÅÅÅ-MM-DD), `time` (HH:MM), `place`, `desc`,
`url` (länk till eventets publika sida; utlämnad url ger ett olänkat kort), `source` (`app`).

Backend kan dessutom skicka `startsAt` och `endsAt` som UTC ISO-tidsstämplar
(exempel: `2026-10-30T17:00:00.000Z`). `date` och `time` behålls för äldre klienter.
Med ISO-fälten visas start–slut i **Europe/Stockholm**, oavsett besökarens tidszon.
Om intervallet går över midnatt visas även datumen och årtalen. Eventet försvinner
vid sluttiden, som också används i JSON-LD `endDate`. Kort och JSON-LD uppdateras
tillsammans vid tidsgränser och när fliken blir synlig igen.

Äldre event utan ISO-fält behåller datum/tid-visningen och den tidigare marginalen
på sex timmar efter start. Saknad eller ogiltig `startsAt` faller tillbaka till
`date`/`time` (besökarens lokala tid, som tidigare; utan tid används kl. 12).
Saknad/ogiltig `endsAt`, eller slut före/lika med start, ger sex timmars marginal
från start och inget `endDate`. Felaktiga tilläggsfält slår inte ut resten av flödet.
Event med annan explicit `source` än `app` ignoreras; äldre poster utan `source`
kan fortfarande visas från appens flödesfil.

Regressionstester utan extra beroenden: `node --test scripts/event-times.test.cjs`.
Kör gärna även med annan besökartidszon, till exempel
`TZ=Pacific/Honolulu node --test scripts/event-times.test.cjs`.

### Instagram
GitHub Action-flödet **`.github/workflows/instagram.yml`** kör varje morgon
(och manuellt via *Actions → Uppdatera Instagram-flödet → Run workflow*).
Det använder [Instaloader](https://instaloader.github.io/) (öppen källkod) för att hämta
de 9 senaste inläggen från
[@kungsbackacarcommunity](https://www.instagram.com/kungsbackacarcommunity),
sparar bilderna i `assets/instagram/` och skriver `data/instagram.json`.

> Nuvarande design visar ingen Instagram-galleri-sektion på sidan, men datat och flödet
> ligger kvar redo att kopplas in igen. Vill ni visa flödet, säg till.

**Engångsinställning (om ni aktiverar flödet):**
1. Logga in på instagram.com i webbläsaren.
2. DevTools → *Application* → *Cookies* → `instagram.com` → kopiera värdet av `sessionid`.
3. I repot: *Settings → Secrets and variables → Actions → New repository secret*
   — namn `IG_SESSIONID`, klistra in värdet.

Om cookien går ut slutar hämtningen fungera — upprepa då steg 1–3. Automatisk hämtning
sker på egen risk; Instagram kan begränsa kontot som cookien tillhör. Använd gärna ett
separat konto.

## Sponsorlogotyper
Sektionen "Samarbeten" visar partnernamnen som textkort (bildfilerna på gamla sajten
gick inte att länka in stabilt). Vill ni ha riktiga logotyper: lägg filerna i
`assets/sponsors/` och byt ut texten i respektive kort mot en
`<img src="assets/sponsors/filnamn.png" ...>`.

## Deploy till cPanel

1. I cPanel: **Git™ Version Control → Create** och koppla detta GitHub-repo.
2. **`.cpanel.yml`** pekar på `/home/kungsba4/public_html/` — justera sökvägen om
   sidan ska ligga i en underdomän/underkatalog.
3. Push till `main` → i cPanel: **Manage → Pull or Deploy → Deploy HEAD Commit**
   (eller aktivera automatisk deploy). Filerna kopieras till `public_html`.

Bot-commiten från Instagram-flödet syncas ut på samma sätt som vanliga ändringar.
Se cPanels guide: <https://docs.cpanel.net/cpanel/files/git-version-control/>

## Länkar
- Webshop (Roader Wear): <https://roaderwear.com/en/collections/kungsbacka-car-community>
- Instagram: <https://www.instagram.com/kungsbackacarcommunity>
- Facebook-grupp: <https://www.facebook.com/groups/794040558638195/>
- Kontakt: kontakt@kungsbackacarcommunity.se
