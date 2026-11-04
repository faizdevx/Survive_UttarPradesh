// Tests the fog score against real airport observations from last winter, then writes the result.
// Tuned on December, scored on January, so the published numbers are not marked by their own answers.
// Observations: Iowa Environmental Mesonet METAR archive. Weather: Open-Meteo historical forecasts.
// Run with: node scripts/kohra-backtest.mjs
import fs from 'node:fs';

const UA = { 'User-Agent': 'SurviveUP/0.1 (github.com/faizdevx/Survive_UttarPradesh)' };
const STATIONS = { VILK: 'Lucknow', VIAG: 'Agra', VEGK: 'Gorakhpur', VEBN: 'Varanasi', VIBY: 'Bareilly', VICX: 'Kanpur Nagar', VIAL: 'Prayagraj', VIDX: 'Ghaziabad', VEAY: 'Ayodhya' };
const districts = JSON.parse(fs.readFileSync('public/data/districts.json'));
const START = '2025-12-01';
const END = '2026-01-31';

async function observed(id) {
  const month = async (y1, m1, y2, m2) => {
    const u = `https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?station=${id}&data=vsby&data=wxcodes&year1=${y1}&month1=${m1}&day1=1&year2=${y2}&month2=${m2}&day2=1&tz=Asia%2FKolkata&format=onlycomma&latlon=no&missing=empty&trace=empty&direct=no&report_type=3&report_type=4`;
    // The archive asks for one request at a time, and hangs up when it is busy
    for (let tries = 0; tries < 4; tries += 1) {
      await new Promise((r) => setTimeout(r, 2500 + tries * 8000));
      try {
        const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(120000) });
        if (r.ok) return (await r.text()).trim().split('\n').slice(1);
      } catch { /* tries again after a longer wait */ }
    }
    console.log('gave up on', id, y1, m1);
    return [];
  };
  const lines = [...await month(2025, 12, 2026, 1), ...await month(2026, 1, 2026, 2)];
  const out = {};
  lines.forEach((line) => {
    const [, valid, vsby, wx] = line.split(',');
    if (!valid || vsby === '') return;
    const key = valid.slice(0, 13).replace(' ', 'T');
    const metres = Number(vsby) * 1609.34;
    const fogWord = /FG/.test(wx || '') && !/BCFG|MIFG|PRFG/.test(wx || '');
    // Keep the worst report in each hour
    if (out[key] == null || metres < out[key].m) out[key] = { m: metres, fogWord };
  });
  return out;
}

async function model(d) {
  const u = `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${d.lat}&longitude=${d.lng}&start_date=${START}&end_date=${END}&hourly=visibility,temperature_2m,relative_humidity_2m,dew_point_2m,wind_speed_10m&timezone=Asia%2FKolkata`;
  const h = (await (await fetch(u, { headers: UA, signal: AbortSignal.timeout(60000) })).json()).hourly;
  return h.time.map((t, i) => ({ t, vis: h.visibility[i], temp: h.temperature_2m[i], rh: h.relative_humidity_2m[i], gap: h.temperature_2m[i] - h.dew_point_2m[i], wind: h.wind_speed_10m[i] }));
}

const rows = [];
const used = [];
for (const [id, name] of Object.entries(STATIONS)) {
  const obs = await observed(id);
  const n = Object.keys(obs).length;
  if (n < 300) { console.log('skip', id, name, n, 'hours'); continue; }
  used.push({ id, district: name, hours: n });
  const hours = await model(districts[name]);
  // One row per station per morning: the worst model hour and the worst observed hour from 3 to 9 AM
  const days = {};
  hours.forEach((x) => {
    const hour = Number(x.t.slice(11, 13));
    if (hour < 3 || hour > 9 || x.vis == null) return;
    const o = obs[x.t.slice(0, 13)];
    const day = (days[x.t.slice(0, 10)] ||= { id, day: x.t.slice(0, 10), obsMin: Infinity, model: [] });
    if (o) days[x.t.slice(0, 10)].obsMin = Math.min(days[x.t.slice(0, 10)].obsMin, o.m);
    day.model.push(x);
  });
  Object.values(days).filter((d) => d.obsMin !== Infinity).forEach((d) => rows.push(d));
  await new Promise((r) => setTimeout(r, 400));
}

const hitWith = (x, p) => x.vis < p.vis || (x.gap <= p.gap && x.rh >= p.rh && x.wind <= p.wind && x.temp < 24);
const flagged = (row, p) => row.model.some((x) => hitWith(x, p));
function score(list, p, fogBelow) {
  let hit = 0; let miss = 0; let falseAlarm = 0; let clear = 0;
  list.forEach((r) => {
    const fog = r.obsMin < fogBelow;
    const said = flagged(r, p);
    if (fog && said) hit += 1; else if (fog) miss += 1; else if (said) falseAlarm += 1; else clear += 1;
  });
  const caught = hit + miss ? hit / (hit + miss) : 0;
  const rightWhenWarned = hit + falseAlarm ? hit / (hit + falseAlarm) : 0;
  // Critical success index: a fair single score when fog is the rarer event
  const csi = hit + miss + falseAlarm ? hit / (hit + miss + falseAlarm) : 0;
  return { hit, miss, falseAlarm, clear, caught, rightWhenWarned, csi };
}

const train = rows.filter((r) => r.day.startsWith('2025-12'));
const test = rows.filter((r) => r.day.startsWith('2026-01'));
const LEVELS = { 1: 1000, 2: 500, 3: 200 };
const chosen = {};
const report = {};
for (const [lv, fogBelow] of Object.entries(LEVELS)) {
  let best = null;
  for (const vis of [200, 500, 1000, 2000, 3000, 5000]) for (const gap of [0.3, 0.5, 1, 1.5, 2, 3, 4]) for (const rh of [80, 85, 90, 93, 95, 97]) for (const wind of [4, 6, 8, 10, 14]) {
    const p = { vis, gap, rh, wind };
    const s = score(train, p, fogBelow);
    if (!best || s.csi > best.s.csi) best = { p, s };
  }
  chosen[lv] = best.p;
  report[lv] = { fogBelow, params: best.p, december: best.s, january: score(test, best.p, fogBelow), oldRule: score(test, { 1: { vis: 1000, gap: 2, rh: 90, wind: 10 }, 2: { vis: 500, gap: 1, rh: 95, wind: 8 }, 3: { vis: 200, gap: 0.5, rh: 97, wind: 6 } }[lv], fogBelow) };
}
const days = (list, below) => list.filter((r) => r.obsMin < below).length;
const out = {
  checkedOn: new Date().toISOString().slice(0, 10), period: `${START} to ${END}`, stations: used, mornings: rows.length,
  observed: { fog1000: days(rows, 1000), fog500: days(rows, 500), fog200: days(rows, 200) }, levels: report,
  source: { observations: 'https://mesonet.agron.iastate.edu/request/download.phtml', model: 'https://open-meteo.com/en/docs/historical-forecast-api' },
};
fs.writeFileSync('public/data/kohra-check.json', JSON.stringify(out));
const pc = (x) => `${Math.round(x * 100)}%`;
console.log({ stations: used.map((u) => `${u.id}:${u.hours}`), mornings: rows.length, observed: out.observed });
Object.entries(report).forEach(([lv, r]) => console.log(`L${lv} <${r.fogBelow}m`, JSON.stringify(r.params), '| Jan caught', pc(r.january.caught), 'right when warned', pc(r.january.rightWhenWarned), `hit ${r.january.hit} miss ${r.january.miss} false ${r.january.falseAlarm} | old rule caught`, pc(r.oldRule.caught), 'right', pc(r.oldRule.rightWhenWarned), `| Dec caught ${pc(r.december.caught)}`));
