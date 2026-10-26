const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

// Execute the actual inline homepage script, including fetch/render/timers/JSON-LD.
const html = readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
const base = {
  title: 'Kvällsträff', date: '2026-10-30', time: '18:00', place: 'Kungsbacka', source: 'app',
  startsAt: '2026-10-30T17:00:00.000Z', endsAt: '2026-10-30T20:00:00.000Z'
};

async function page(events, at = '2026-10-30T16:00:00Z', response = {}) {
  let now = new Date(at).getTime();
  let timerId = 0;
  const timers = new Map();
  const listeners = {};
  const elements = new Map();
  function element(id) {
    const el = { id, innerHTML: '', textContent: '', style: {},
      remove() { elements.delete(this.id); } };
    elements.set(id, el);
    return el;
  }
  for (const id of ['kcc-year', 'kcc-events', 'kcc-countdown', 'kcc-cd-days', 'kcc-cd-hours', 'kcc-cd-mins']) element(id);
  class FakeDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  vm.runInNewContext(script, {
    Date: FakeDate, Intl, URL,
    document: {
      getElementById: id => elements.get(id) || null,
      createElement: () => ({ textContent: '', remove() { elements.delete(this.id); } }),
      head: { appendChild: el => elements.set(el.id, el) },
      querySelectorAll: () => [],
      addEventListener: (name, cb) => { listeners[name] = cb; }
    },
    window: { addEventListener() {}, requestAnimationFrame() {} },
    setTimeout: (cb, delay) => { timers.set(++timerId, { cb, at: now + delay }); return timerId; },
    clearTimeout: id => timers.delete(id),
    setInterval() {},
    fetch: async url => {
      if (url !== 'data/app-events.json') return { ok: true, json: async () => null };
      if (response.networkError) throw new Error('Offline');
      return { ok: response.ok !== false, json: async () => {
        if (response.brokenJson) throw new SyntaxError('Invalid JSON');
        return response.body === undefined ? { events } : response.body;
      } };
    }
  }, { filename: 'index.html' });
  await new Promise(resolve => setImmediate(resolve));
  return {
    cards: () => elements.get('kcc-events').innerHTML,
    ld: () => JSON.parse(elements.get('kcc-event-ld')?.textContent || '{"@graph":[]}')['@graph'],
    countdown: () => elements.get('kcc-countdown').style.display,
    hours: () => elements.get('kcc-cd-hours').textContent,
    advance(at) {
      const target = new Date(at).getTime();
      for (;;) {
        const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > target) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].cb();
      }
      now = target;
    },
    resume(at) { now = new Date(at).getTime(); listeners.visibilitychange(); },
    delays: () => [...timers.values()].map(t => t.at - now)
  };
}

test('same-day Stockholm interval and canonical JSON-LD override legacy display fields', async () => {
  const p = await page([{ ...base, date: '2026-10-29', time: '09:00' }]);
  assert.match(p.cards(), /Fredag 18:00–21:00 · Kungsbacka/);
  assert.match(p.cards(), />30<\/div>/);
  assert.equal(p.ld()[0].startDate, base.startsAt);
  assert.equal(p.ld()[0].endDate, base.endsAt);
  assert.equal(p.hours(), '1');
});

test('overnight, multiday and year rollover intervals include both local dates', async () => {
  for (const [start, end, label] of [
    ['2026-10-30T21:00:00Z', '2026-10-31T01:00:00Z', 'Fredag 30 okt 2026 22:00–Lördag 31 okt 2026 02:00'],
    ['2026-10-30T21:00:00Z', '2026-11-01T12:00:00Z', 'Fredag 30 okt 2026 22:00–Söndag 1 nov 2026 13:00'],
    ['2026-12-31T22:00:00Z', '2027-01-01T01:00:00Z', 'Torsdag 31 dec 2026 23:00–Fredag 1 jan 2027 02:00']
  ]) {
    const p = await page([{ ...base, startsAt: start, endsAt: end }]);
    assert.ok(p.cards().includes(label), p.cards());
  }
});

test('Stockholm DST transitions and summer date badge are independent of visitor timezone', async () => {
  for (const [start, end, at, label, day] of [
    ['2026-03-29T00:30:00Z', '2026-03-29T01:30:00Z', '2026-03-28T00:00:00Z', 'Söndag 01:30–03:30', '29'],
    ['2026-10-24T21:30:00Z', '2026-10-25T02:30:00Z', '2026-10-24T00:00:00Z', 'Lördag 24 okt 2026 23:30–Söndag 25 okt 2026 03:30', '24'],
    ['2026-06-01T22:30:00Z', '2026-06-02T00:00:00Z', '2026-06-01T00:00:00Z', 'Tisdag 00:30–02:00', '2']
  ]) {
    const p = await page([{ ...base, startsAt: start, endsAt: end }], at);
    assert.ok(p.cards().includes(label));
    assert.ok(p.cards().includes('>' + day + '</div>'));
  }
});

test('ongoing event survives beyond six hours and disappears exactly at end, including JSON-LD', async () => {
  const p = await page([{ ...base, startsAt: '2026-10-29T17:00:00Z', endsAt: '2026-10-30T16:00:07.125Z' }]);
  assert.match(p.cards(), /Kvällsträff/);
  assert.equal(p.countdown(), 'none');
  assert.deepEqual(p.delays(), [7125]);
  p.advance('2026-10-30T16:00:07.124Z');
  assert.equal(p.ld().length, 1);
  p.advance('2026-10-30T16:00:07.125Z');
  assert.match(p.cards(), /Garaget är tyst/);
  assert.equal(p.ld().length, 0);
});

test('already-ended events are absent at the exact end instant', async () => {
  const p = await page([base], base.endsAt);
  assert.match(p.cards(), /Garaget är tyst/);
  assert.equal(p.ld().length, 0);
});

test('countdown skips ongoing events and switches to the next future start at the boundary', async () => {
  const p = await page([
    { ...base, title: 'Later', startsAt: '2026-10-30T19:00:00Z', endsAt: '2026-10-30T22:00:00Z' },
    { ...base, title: 'Ongoing', startsAt: '2026-10-30T14:00:00Z' },
    { ...base, title: 'Next' }
  ]);
  assert.deepEqual(p.ld().map(x => x.name), ['Ongoing', 'Next', 'Later']);
  assert.equal(p.hours(), '1');
  p.advance(base.startsAt);
  assert.equal(p.hours(), '2');
  p.advance('2026-10-30T19:00:00Z');
  assert.equal(p.countdown(), 'none');
  assert.equal(p.ld().length, 3);
});

test('six ongoing cards still allow a countdown to the seventh future event', async () => {
  const events = Array.from({ length: 6 }, (_, i) => ({ ...base, title: 'Ongoing ' + i, startsAt: '2026-10-29T17:00:00Z' }));
  const p = await page([...events, { ...base, title: 'Future' }]);
  assert.equal(p.ld().length, 6);
  assert.doesNotMatch(p.cards(), /Future/);
  assert.equal(p.hours(), '1');
});

test('legacy entries retain six-hour grace, local display and date-only noon fallback', async () => {
  const legacy = { title: 'Legacy', date: '2026-10-30', time: '18:00' };
  const start = new Date('2026-10-30T18:00').getTime();
  const p = await page([legacy], start + 5 * 36e5);
  assert.match(p.cards(), /Fredag 18:00/);
  assert.equal(p.countdown(), 'none');
  assert.equal(p.ld()[0].startDate, '2026-10-30T18:00');
  assert.equal(p.ld()[0].endDate, undefined);
  p.advance(start + 6 * 36e5);
  assert.equal(p.ld().length, 0);
  const q = await page([{ title: 'Noon', date: '2026-10-30' }], new Date('2026-10-30T11:00').getTime());
  assert.equal(q.hours(), '1');
  assert.equal(q.ld()[0].startDate, '2026-10-30');
});

test('invalid optional timestamps fall back per entry without poisoning the feed', async () => {
  for (const invalid of [null, 123, {}, 'invalid', '2026-10-30T20:00:00', '2026-02-30T20:00:00.000Z', '2026-10-30T16:00:00Z', base.startsAt]) {
    const p = await page([{ ...base, endsAt: invalid }]);
    assert.match(p.cards(), /Fredag 18:00 ·/);
    assert.equal(p.ld()[0].endDate, undefined);
    p.advance('2026-10-30T23:00:00Z');
    assert.equal(p.ld().length, 0);
  }
  const p = await page([{ ...base, startsAt: 'broken', endsAt: null }], new Date('2026-10-30T17:00').getTime());
  assert.equal(p.hours(), '1');
  assert.equal(p.ld()[0].startDate, '2026-10-30T18:00');
});

test('malformed entries and non-app sources are ignored; HTML and URLs remain safe', async () => {
  const p = await page([null, [], 42, 'bad', {}, { date: 'not a date' }, { ...base, time: {} },
    { ...base, source: 'manual', title: 'Manual' },
    { ...base, title: '<img src=x onerror=alert(1)>', desc: '</script><script>alert(1)</script>', place: '<b>Place</b>', url: 'javascript:alert(1)' },
    { ...base, title: 'Link', url: 'https://example.com/?a=1&b="quoted"' }
  ]);
  assert.equal(p.ld().length, 2);
  assert.doesNotMatch(p.cards(), /Manual|<img|<script|javascript:/);
  assert.match(p.cards(), /&lt;img/);
  assert.match(p.cards(), /&lt;b&gt;Place&lt;\/b&gt;/);
  assert.match(p.cards(), /a=1&amp;b=&quot;quoted&quot;/);
  assert.match(p.cards(), /target="_blank" rel="noopener"/);
  assert.equal(p.ld()[0].url, 'https://kungsbackacarcommunity.se/#event');
});

test('missing, malformed or failed feed produces the existing empty state', async () => {
  for (const response of [{ ok: false }, { networkError: true }, { brokenJson: true }, { body: null }, { body: { events: {} } }, {}]) {
    const p = await page([], undefined, response);
    assert.match(p.cards(), /Garaget är tyst/);
    assert.equal(p.countdown(), 'none');
    assert.equal(p.ld().length, 0);
  }
});

test('resuming a throttled tab removes expired cards and structured data', async () => {
  const p = await page([base]);
  p.resume('2026-10-31T00:00:00Z');
  assert.equal(p.ld().length, 0);
  assert.match(p.cards(), /Garaget är tyst/);
});

test('far future starts cap browser timeouts instead of overflowing into a busy loop', async () => {
  const p = await page([{ ...base, startsAt: '2027-10-30T17:00:00Z', endsAt: null }]);
  assert.deepEqual(p.delays(), [2147483647]);
});
