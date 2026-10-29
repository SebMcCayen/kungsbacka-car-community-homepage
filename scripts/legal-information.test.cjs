// Run locally with: node --test scripts/legal-information.test.cjs
// Copy/URL regression guards, not runtime, legal-compliance or deployment tests.
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const { test } = require('node:test');

const root = resolve(__dirname, '..');
const files = ['integritetspolicy.html', 'anvandarvillkor.html', 'radera-konto.html', 'support.html'];
const pages = Object.fromEntries(files.map(file => [file, readFileSync(resolve(root, file), 'utf8')]));
const clean = html => html.replace(/<!--[\s\S]*?-->/g, '');
const text = html => clean(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const ids = html => [...clean(html).matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
function section(file, id) {
  const html = clean(pages[file]);
  const start = html.search(new RegExp(`<h[23] id="${id}">`));
  assert.notEqual(start, -1, `${file}#${id} exists`);
  const tail = html.slice(start);
  const next = tail.slice(1).search(/<h2\b|<\/main>/);
  return text(next < 0 ? tail : tail.slice(0, next + 1));
}

test('canonical pages retain local assets, navigation and accessible English fragments', () => {
  for (const [file, source] of Object.entries(pages)) {
    const html = clean(source);
    assert.match(html, /<html lang="sv">/);
    assert.match(html, /<main class="kcc-doc">/);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, file);
    assert.equal(new Set(ids(html)).size, ids(html).length, `${file}: unique IDs`);
    assert.match(html, /<section lang="en" aria-labelledby="english">\s*<h2 id="english">/);
    assert.match(html, /href="#english" lang="en"/);
    assert.match(html, /Senast uppdaterad 29 oktober 2026/);
    assert.match(html, /href="assets\/legal.css"/);
    assert.match(html, /<img src="assets\/logo-main.png" alt="Kungsbacka Car Community">/);
    const nav = html.match(/<nav\b[\s\S]*?<\/nav>/)[0];
    assert.deepEqual([...nav.matchAll(/href="([^"]+)"/g)].map(m => m[1]), [
      'index.html#hem', 'index.html#om-oss', 'index.html#event', 'support.html',
      'https://www.facebook.com/groups/794040558638195/'
    ], `${file}: existing navigation`);
    const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    assert.deepEqual(scripts, ["document.getElementById('kcc-year').textContent=String(new Date().getFullYear());"]);
    assert.doesNotMatch(html, /<style\b|<iframe\b|\bon\w+\s*=/i);
    for (const match of html.matchAll(/<(?:a|link|img)\b[^>]*>/g)) {
      const tag = match[0];
      const url = tag.match(/\b(?:href|src)="([^"]+)"/)?.[1];
      if (!url) continue;
      if (url.startsWith('mailto:')) {
        assert.equal(url.split('?')[0], 'mailto:kontakt@kungsbackacarcommunity.se');
      } else if (/^https:/.test(url)) {
        if (tag.includes('target="_blank"')) assert.match(tag, /rel="[^\"]*\bnoopener\b/);
      } else {
        assert.doesNotMatch(url, /^\w+:|^\/\//, `${file}: no unexpected URL scheme`);
        const [target, fragment] = url.split('#');
        const path = target ? resolve(root, dirname(file), target) : resolve(root, file);
        assert.ok(existsSync(path), `${file}: missing local target ${url}`);
        if (fragment) assert.ok(ids(readFileSync(path, 'utf8')).includes(fragment), `${file}: broken fragment ${url}`);
      }
    }
  }
});

test('both apps require 18 without guardian exceptions or retrospective acceptance', () => {
  for (const file of files) {
    assert.match(text(pages[file]), /Sebastian Stegrin/);
    assert.doesNotMatch(text(pages[file]), /13\s*(?:år|years)|målsman|guardian|Fortsatt användning.*accepterar|continued use.*accept/i);
  }
  assert.match(section('integritetspolicy.html', 'barn'), /minst 18 år.*både CarCommunity och Driver/);
  assert.match(section('anvandarvillkor.html', 'konto'), /minst 18 år.*både CarCommunity och Driver/);
  assert.match(section('integritetspolicy.html', 'barn'), /inte ett påstående.*tekniskt verifierar/);
  for (const file of ['integritetspolicy.html', 'anvandarvillkor.html']) {
    const changes = section(file, 'andringar');
    assert.match(changes, /2 september 2026/);
    assert.match(changes, /inte retroaktivt/);
    assert.match(changes, /väsentliga ändringar informerar/i);
    assert.match(changes, /(?:nytt godkännande|godkännande.*inhämtas)/);
  }
  assert.match(section('integritetspolicy.html', 'andringar'), /tidigare godkännande.*inte automatiskt/);
});

test('public pages explain user choices without internal audit or configuration commentary', () => {
  for (const [file, html] of Object.entries(pages)) {
    assert.doesNotMatch(html, /<!--|funktionsflagg|feature flag|global flag|driverProfiles|cleanup hook|deployment activation|europe-west1|#[0-9]{3,}|\b(?:commit|source SHA)\b/i, file);
  }
});

test('published legal bases, personal statistics choice and consent remain distinct', () => {
  const bases = section('integritetspolicy.html', 'andamal');
  assert.match(bases, /tillhandahålla tjänsten.*fullgörande av avtal/);
  assert.match(bases, /Platsdelning och närhetsfunktioner.*ditt samtycke/);
  assert.match(bases, /Säkerhet, missbruksskydd och felsökning.*berättigat intresse/);
  assert.match(bases, /Valfria aviseringar.*ditt samtycke/);
  assert.match(bases, /operativsystemet är inte i sig ett informerat samtycke/);
  const stats = section('integritetspolicy.html', 'partnerstatistik');
  assert.match(stats, /personliga valet.*på som standard/);
  assert.match(stats, /Om köranalysen är aktiv och ditt statistikval är på/);
  assert.match(stats, /förvalt på-läge innebär inte.*aktivt samtycke/);
  assert.match(stats, /stänga av.*Integritet.*Spara/);
  assert.match(stats, /inte att alla interaktionshändelser upphör/);
  assert.match(stats, /90 dagarna.*200 metrarna.*10 olika användare/);
  assert.match(stats, /inte en automatisk raderingsfrist för ruttfiler/);
  assert.match(stats, /policyuppdateringen ändrar inte ditt val.*inte i sig tillåtelse/);
  const english = section('integritetspolicy.html', 'english');
  assert.match(english, /setting defaults on.*not affirmative consent/);
  assert.match(english, /If the feature is active and your setting is enabled/);
  assert.match(english, /Turn off.*Privacy.*save/);
  assert.match(english, /Other partner interactions can still be recorded/);
  assert.match(english, /OS permission alone is not informed affirmative consent/);
  assert.match(english, /does not retroactively authorise/);
});

test('retention explains actual intervals, uncertain automatic erasure and provider limits', () => {
  const retention = section('integritetspolicy.html', 'lagring');
  assert.match(retention, /communitymeddelanden.*120 dagar.*konvojmeddelanden.*30 dagar/);
  assert.match(retention, /Radering efter dessa tider kräver.*automatisk radering.*aktiverad/);
  assert.match(retention, /inte bekräfta.*inte lova att meddelandena tas bort då/);
  assert.match(retention, /Direktmeddelanden och eventchatt har ingen generell/);
  assert.match(retention, /diagnostikrapporter.*90-dagarsgräns.*månatligt städjobb/);
  assert.match(retention, /Råa partnerinteraktioner.*sjudagarsgräns.*dagligt städjobb/);
  assert.match(retention, /sammanställningsperioder är inte raderingsfrister/);
  assert.match(retention, /eventriskreferenser.*saknar en verifierad automatisk raderingsfrist/);
  assert.match(section('integritetspolicy.html', 'plats'), /15 minuter.*var femte minut.*koordinater.*kan finnas kvar/);
  for (const file of ['integritetspolicy.html', 'radera-konto.html']) {
    const copy = text(pages[file]);
    assert.match(copy, /Authentication-data.*180 dagar.*initierat radering/);
    assert.match(pages[file], /href="https:\/\/firebase.google.com\/support\/privacy"/);
    assert.doesNotMatch(copy, /[Ss]äkerhetskopior.{0,100}(?:inom|within) 90/);
    assert.match(copy, /(?:identifierare är inte automatiskt anonyma|innehålla identifierare även när de är hashade)/);
  }
  assert.match(section('integritetspolicy.html', 'delning'), /Google \/ Firebase.*beror på vilken tjänst.*stannar inte inom EU\/EES/);
  assert.match(section('integritetspolicy.html', 'delning'), /Mapbox.*globalt/);
});

test('whole-account and Driver-only deletion have independent queues and truthful limits', () => {
  const timing = section('radera-konto.html', 'tidsramar');
  assert.match(timing, /mer än 30 dagar/);
  assert.match(timing, /dagligt jobb.*begränsad kö.*försöker igen/);
  assert.match(timing, /inte en garanti.*inom 30 dagar/);
  assert.match(timing, /hela kontot finns ingen sjudagarsväntan.*Driver-innehåll kan försvinna tidigare/);
  assert.match(timing, /väntar inte på att Driver blir färdig/);
  assert.match(timing, /Kontakta oss om innehåll verkar finnas kvar.*status/);
  assert.match(timing, /inget automatiskt meddelande/);
  assert.match(section('radera-konto.html', 'driver'), /Bara Driver:.*efter sju dagar.*gemensamma klubbar och medlemskap finns kvar/);
  const deleted = section('radera-konto.html', 'vad-raderas');
  assert.match(deleted, /ruttfiler.*egna chattmeddelanden.*eventanmälningar.*direktmeddelandekonversationer/);
  assert.match(deleted, /Citat eller kopior.*kan finnas kvar/);
  assert.match(deleted, /Drivers separata process tar bort eller tömmer.*raderingsmarkörer/);
  assert.match(deleted, /klubbar.*separat process.*återkallar medlemskap.*arkiverar ägda klubbar/);
  assert.match(section('radera-konto.html', 'begar-radering'), /utan att installera.*Mejla.*fråga om status/);
  const english = section('radera-konto.html', 'english');
  assert.match(english, /separate cleanup in both apps, processed daily/);
  assert.match(english, /Driver content may be removed earlier/);
  assert.match(english, /completion within 30 days is not guaranteed/);
  assert.match(english, /contact us if content remains.*status update/);
});

test('paid Android subscriptions, restoration and independent cancellation are already available', () => {
  for (const file of ['anvandarvillkor.html', 'support.html']) {
    const copy = text(pages[file]);
    assert.match(copy, /Plus 39 SEK per månad.*Supporter 119 SEK per månad/);
    assert.match(copy, /pris.*valuta.*debiteringsperiod.*förnyelsevillkor/);
    assert.match(copy, /Återställ köp.*samma Google Play-konto/);
    assert.match(copy, /Google Play → Prenumerationer/);
    assert.doesNotMatch(copy, /Om och när prenumerationer|i framtiden ingå|innan betalfunktioner aktiveras/);
    assert.match(copy, /administratör.*moderering/i);
    assert.match(copy, /ompröv/i);
  }
  assert.match(section('anvandarvillkor.html', 'prenumeration'), /radera kontot säger inte automatiskt upp/);
  assert.match(section('radera-konto.html', 'prenumeration'), /radera kontot avslutar inte automatiskt/);
  assert.match(text(pages['support.html']), /iOS-appen är under utveckling/);
});
