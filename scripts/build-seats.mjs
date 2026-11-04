// Builds public/data/seats.json and seats.geojson for Chunav mode.
// Boundaries: DataMeet India_AC (CC BY 2.5 IN). Results: Wikipedia, 2022 UP Assembly election.
// Needs public/data/netas.json, so run build-netas.mjs first. Run with: node scripts/build-seats.mjs
import fs from 'node:fs';

const UA = { 'User-Agent': 'SurviveUP/0.1 (github.com/faizdevx/Survive_UttarPradesh)' };
const RAW = 'https://raw.githubusercontent.com/datameet/maps/master/assembly-constituencies/India_AC';
const buffer = async (url) => Buffer.from(await (await fetch(url, { headers: UA })).arrayBuffer());

/* Shapefile reader, polygons only */
function readDbf(b) {
  const count = b.readUInt32LE(4);
  const headerLen = b.readUInt16LE(8);
  const rowLen = b.readUInt16LE(10);
  const fields = [];
  for (let o = 32; b[o] !== 13; o += 32) fields.push({ name: b.toString('latin1', o, o + 11).replace(/\0.*/, ''), len: b[o + 16] });
  return Array.from({ length: count }, (_, i) => {
    let o = headerLen + i * rowLen + 1;
    const row = {};
    for (const f of fields) { row[f.name] = b.toString('latin1', o, o + f.len).trim(); o += f.len; }
    return row;
  });
}
function readShp(b) {
  const shapes = [];
  for (let o = 100; o < b.length;) {
    const len = b.readInt32BE(o + 4) * 2;
    const rec = o + 8;
    if (b.readInt32LE(rec) === 5) {
      const parts = b.readInt32LE(rec + 36);
      const points = b.readInt32LE(rec + 40);
      const starts = Array.from({ length: parts }, (_, i) => b.readInt32LE(rec + 44 + i * 4));
      const base = rec + 44 + parts * 4;
      shapes.push(starts.map((s, i) => {
        const end = i + 1 < parts ? starts[i + 1] : points;
        return Array.from({ length: end - s }, (_, k) => [b.readDoubleLE(base + (s + k) * 16), b.readDoubleLE(base + (s + k) * 16 + 8)]);
      }));
    } else shapes.push([]);
    o = rec + len;
  }
  return shapes;
}

// Douglas-Peucker, keeps the file small enough to load on a phone
function simplify(ring, tol) {
  if (ring.length < 5) return ring;
  const [x0, y0] = ring[0];
  const [xn, yn] = ring[ring.length - 1];
  if (x0 === xn && y0 === yn) {
    let far = 0;
    let at = 1;
    ring.forEach(([x, y], i) => { const d = Math.hypot(x - x0, y - y0); if (d > far) { far = d; at = i; } });
    return [...simplify(ring.slice(0, at + 1), tol).slice(0, -1), ...simplify(ring.slice(at), tol)];
  }
  const keep = new Array(ring.length).fill(false);
  keep[0] = keep[ring.length - 1] = true;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [a, z] = stack.pop();
    let far = 0;
    let at = -1;
    const [ax, ay] = ring[a];
    const [zx, zy] = ring[z];
    const dx = zx - ax;
    const dy = zy - ay;
    const len = Math.hypot(dx, dy) || 1e-12;
    for (let i = a + 1; i < z; i += 1) {
      const d = Math.abs(dy * (ring[i][0] - ax) - dx * (ring[i][1] - ay)) / len;
      if (d > far) { far = d; at = i; }
    }
    if (far > tol) { keep[at] = true; stack.push([a, at], [at, z]); }
  }
  return ring.filter((_, i) => keep[i]);
}
const TOL = 0.0012;
const round = (p) => [+p[0].toFixed(4), +p[1].toFixed(4)];

const rows = readDbf(await buffer(`${RAW}.dbf`));
const shapes = readShp(await buffer(`${RAW}.shp`));
if (rows.length !== shapes.length) throw new Error(`rows ${rows.length}, shapes ${shapes.length}`);

/* 2022 results */
const page = await (await fetch('https://en.wikipedia.org/w/api.php?action=parse&format=json&prop=wikitext&page=2022_Uttar_Pradesh_Legislative_Assembly_election', { headers: UA })).json();
const wiki = page.parse.wikitext['*'];
const from = wiki.indexOf('=== Results by constituency');
const table = wiki.slice(from, wiki.indexOf('\n|}', from));
const clean = (c) => c.replace(/^(?:[a-z]+="[^"]*"\s*)+\|/i, '').replace(/\{\{[^}]*\}\}/g, '').replace(/<[^>]+>/g, '').replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1').replace(/'''?/g, '').trim();
const num = (c) => Number(clean(c).replace(/^.*\|/, '').replace(/[^\d.]/g, '')) || 0;
const PARTY = {
  'Bharatiya Janata Party': 'BJP', 'Samajwadi Party': 'SP', 'Indian National Congress': 'INC', 'Rashtriya Lok Dal': 'RLD', 'Apna Dal (Sonelal)': 'ADS', 'Apna Dal (Soneylal)': 'ADS', 'Bahujan Samaj Party': 'BSP',
  'Bharatiya Janta Party': 'BJP', 'Nirbal Indian Shoshit Hamara Aam Dal': 'NISHAD', 'NISHAD Party': 'NISHAD', 'Suheldev Bharatiya Samaj Party': 'SBSP', 'Jansatta Dal Loktantrik': 'JDL', 'Jansatta Dal (Loktantrik)': 'JDL',
};
const SHORT = { 'AD(S)': 'ADS', ADS: 'ADS', 'JD(L)': 'JDL', JDL: 'JDL', JSDL: 'JDL', NISHAD: 'NISHAD', NP: 'NISHAD' };
// The colour cell names the party in most rows, the short-name cell after it covers the rest
const partyOf = (colour, short) => {
  const t = colour.match(/party colou?r\|([^}]+)\}\}/i)?.[1].trim();
  const s = clean(short);
  return PARTY[t] || SHORT[s] || s || t || 'IND';
};

const results = {};
for (const row of table.split(/\n\|-/)) {
  const lines = row.split('\n').map((l) => l.trim());
  const at = lines.findIndex((l) => /^!\s*\d{1,3}\s*$/.test(l));
  if (at < 0) continue;
  const no = Number(lines[at].replace(/\D/g, ''));
  const c = lines.slice(at + 1).filter((l) => l.startsWith('|')).map((l) => l.slice(1).trim());
  // name, turnout, winner, colour, party, votes, pct, runner, colour, party, votes, pct, margin
  if (c.length < 13) { results[no] = { bad: c.length }; continue; }
  results[no] = {
    turnout: num(c[1]), winner: clean(c[2]), party: partyOf(c[3], c[4]), votes: num(c[5]), pct: num(c[6]),
    runner: clean(c[7]), runnerParty: partyOf(c[8], c[9]), runnerVotes: num(c[10]), runnerPct: num(c[11]), margin: num(c[12]),
  };
}

/* Bye-elections since 2022 */
const byFrom = wiki.indexOf('== Bypolls');
const byTable = wiki.slice(byFrom, wiki.indexOf('\n|}', byFrom));
const byes = {};
let afterParty = null;
for (const row of byTable.split(/\n\|-/)) {
  const lines = row.split('\n').map((l) => l.trim());
  const at = lines.findIndex((l) => /^!\s*\d{1,3}\s*$/.test(l));
  if (at < 0) continue;
  const c = lines.slice(at + 1).filter((l) => l.startsWith('|')).map((l) => l.slice(1).trim());
  const isParty = (x) => /party name with colou?r/i.test(x);
  const parties = c.filter(isParty);
  const people = c.filter((x) => !isParty(x)).slice(1);
  if (parties.length > 1) afterParty = parties[parties.length - 1].match(/colou?r\|([^|}]+)/i)[1].trim();
  else if (parties.length === 1 && people.length === 1) afterParty = parties[0].match(/colou?r\|([^|}]+)/i)[1].trim();
  byes[Number(lines[at].replace(/\D/g, ''))] = { name: clean(people[people.length - 1] || ''), party: PARTY[afterParty] || afterParty };
}

/* Affidavits, matched on seat name */
const netas = JSON.parse(fs.readFileSync('public/data/netas.json'));
const key = (s) => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '').replace(/nagar$/, 'nagar');
const byKey = {};
for (const [district, list] of Object.entries(netas)) list.forEach((m) => { byKey[key(m.seat)] = { ...m, district }; });
// Same seat, spelled differently by the boundary file and MyNeta
const ALIAS = {
  sawaijpur: 'sawayajpur', kishani: 'kishni', kanpurcantt: 'kanpurcantt', bakshikaatalab: 'bakshikaatalab', bishwavnathganj: 'vishwanathganj', vishwanathganj: 'bishwavnathganj', golagokarnnath: 'golagokrannath', mohammadi: 'mohammdi', varanasicantonment: 'varanasicantt', varanasicantt: 'varanasicantonment',
};

const seats = {};
const features = [];
const report = { noResult: [], badRow: [], noAffidavit: [], noDistrict: [], parties: {} };
rows.forEach((r, i) => {
  if (r.ST_NAME !== 'UTTAR PRADESH') return;
  const no = Number(r.AC_NO);
  const res = results[no];
  if (!res) report.noResult.push(no);
  else if (res.bad) report.badRow.push(`${no}:${res.bad}`);
  const k = key(r.AC_NAME);
  const m = byKey[k] || byKey[ALIAS[k]];
  if (!m) report.noAffidavit.push(`${no} ${r.AC_NAME}`);
  const reserved = r.AC_NAME.match(/\((SC|ST)\)/)?.[1] || null;
  const party = res?.party || null;
  report.parties[party] = (report.parties[party] || 0) + 1;
  seats[no] = {
    no, name: r.AC_NAME.replace(/\s*\((SC|ST)\)/, '').trim(), reserved, district: m?.district || null, lokSabha: r.PC_NAME.replace(/\s*\((SC|ST)\)/, '').trim(),
    ...(res && !res.bad ? res : {}),
    mla: m ? { name: m.name, party: m.party, cases: m.cases, assets: m.assets, edu: m.edu, id: m.id, bye: m.bye } : null,
  };
  // A later bye-election winner replaces the 2022 record, and MyNeta's 2022 page has no affidavit for them
  const seat = seats[no];
  const by = byes[no];
  const same = (a, b) => key(a).slice(0, 5) === key(b || '').slice(0, 5);
  if (by?.name === 'TBD') seat.mla = { name: 'Seat vacant, bye-election pending', party: 'Vacant', cases: null, assets: null, edu: '', id: null, vacant: true };
  else if (by && !(seat.mla?.bye && same(seat.mla.name, by.name))) seat.mla = { name: by.name, party: by.party, cases: null, assets: null, edu: '', id: null, bye: true };
  else if (!seat.mla) seat.mla = { name: seat.winner, party: seat.party, cases: null, assets: null, edu: '', id: null };
  if (!m) { report.noDistrict.push(no); }
  const polys = shapes[i].map((ring) => simplify(ring, TOL).map(round)).filter((ring) => ring.length >= 4);
  features.push({ type: 'Feature', properties: { no }, geometry: { type: 'MultiPolygon', coordinates: polys.map((ring) => [ring]) } });
});

// Districts for seats MyNeta skipped come from their neighbours in the boundary file
const DISTRICT_FROM_FILE = { 'GAUTAM BUDDHA NAGAR *': 'Gautam Buddha Nagar' };
const titleCase = (s) => s.toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase());
rows.forEach((r) => {
  if (r.ST_NAME !== 'UTTAR PRADESH') return;
  const seat = seats[Number(r.AC_NO)];
  if (!seat.district) seat.district = DISTRICT_FROM_FILE[r.DIST_NAME] || titleCase(r.DIST_NAME.replace(/\s*\*$/, ''));
});

// netas.json gets the same corrections, so the city page and Chunav mode agree
const rebuilt = {};
Object.values(seats).forEach((s) => {
  (rebuilt[s.district] ||= []).push({ seat: s.name, ...s.mla, bye: s.mla.bye || undefined, party: s.mla.party });
});
Object.values(rebuilt).forEach((list) => list.sort((a, b) => (b.assets || 0) - (a.assets || 0)));
const known = new Set(Object.keys(JSON.parse(fs.readFileSync('public/data/districts.json'))));
report.unknownDistricts = Object.keys(rebuilt).filter((d) => !known.has(d));
fs.writeFileSync('public/data/netas.json', JSON.stringify(rebuilt));

report.byes = Object.entries(byes).map(([n, b]) => `${n} ${seats[n]?.name}: ${b.name} (${b.party})`);
fs.writeFileSync('public/data/seats.json', JSON.stringify(seats));
fs.writeFileSync('public/data/seats.geojson', JSON.stringify({ type: 'FeatureCollection', features }));
console.log({ seats: Object.keys(seats).length, withResults: Object.values(seats).filter((s) => s.margin).length, withMla: Object.values(seats).filter((s) => s.mla).length, geoKB: Math.round(fs.statSync('public/data/seats.geojson').size / 1024), seatsKB: Math.round(fs.statSync('public/data/seats.json').size / 1024) });
console.log(report);
console.log(JSON.stringify(seats[2]));
