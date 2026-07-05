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
| `data/events.json` | Kommande event (redigeras för hand, se nedan). |
| `data/instagram.json` | Instagram-flöde (fylls av GitHub Action, se nedan). |
| `.github/workflows/instagram.yml` | Schemalagt Instagram-hämtning. |
| `scripts/fetch_instagram.py` | Hämtscriptet (Instaloader). |
| `.cpanel.yml` | Deploy-instruktioner för cPanel. |

## Dynamiskt innehåll

### Event (Facebook)
Facebook tillåter inte att gruppevent hämtas automatiskt (Groups-API:t är stängt).
Eventen ligger därför i **`data/events.json`** — redigera filen direkt på GitHub
(pennikonen → Commit changes). Sidan visar automatiskt bara kommande event,
sorterade efter datum, och nedräkningen pekar på det närmaste. Är listan tom/otillgänglig
faller sidan tillbaka på återkommande träffar (fredagscruising, söndagsträff m.m.).

Fält per event: `title`, `date` (ÅÅÅÅ-MM-DD), `time` (HH:MM), `place`, `desc`, `url`.

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
