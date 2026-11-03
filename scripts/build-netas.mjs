// Builds public/data/netas.json: UP Assembly winners with their declared affidavit figures.
// Source: MyNeta/ADR, 2022 election and later bye-elections. District lists come from the same site.
// Run with: node scripts/build-netas.mjs
import fs from 'node:fs';

const BASE = 'https://www.myneta.info/uttarpradesh2022/';
const page = async (path) => (await fetch(BASE + path, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();

const DISTRICT_ALIAS = {
  'AMBEDKAR NAGAR': 'Ambedkar Nagar', 'GAUTAM BUDDHA NAGAR': 'Gautam Buddha Nagar', 'GAUTAM BUDH NAGAR': 'Gautam Buddha Nagar', KHERI: 'Lakhimpur Kheri', 'LAKHIMPUR KHERI': 'Lakhimpur Kheri',
  BADAUN: 'Budaun', BALIA: 'Ballia', BULANDSAHAR: 'Bulandshahr', SIDDARTHNAGAR: 'Siddharthnagar', BAGHPAT: 'Baghpat', BAGPAT: 'Baghpat', 'KANPUR DEHAT': 'Kanpur Dehat', 'KANPUR NAGAR': 'Kanpur Nagar', 'KUSHI NAGAR': 'Kushinagar', RAEBARELI: 'Rae Bareli', 'RAE BARELI': 'Rae Bareli',
  'SANT KABIR NAGAR': 'Sant Kabir Nagar', 'SANT KABEER NAGAR': 'Sant Kabir Nagar', 'SANT RAVIDAS NAGAR': 'Bhadohi', 'SANT RAVIDAS NAGAR (BHADOHI)': 'Bhadohi', SHRAVASTI: 'Shrawasti', MAHRAJGANJ: 'Maharajganj', 'SIDDHARTH NAGAR': 'Siddharthnagar', AMROHA: 'Amroha', 'JYOTIBA PHULE NAGAR': 'Amroha', FAIZABAD: 'Ayodhya', ALLAHABAD: 'Prayagraj',
};
const title = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const seatKey = (s) => s.replace(/:.*$/, '').replace(/\(.*?\)/g, '').toUpperCase().replace(/[^A-Z]/g, '');

const known = new Set(Object.keys(JSON.parse(fs.readFileSync('public/data/districts.json'))));
const home = await page('');
const seatDistrict = {};
const unknown = [];
for (const m of home.matchAll(/dropbtnJS'[^>]*>\s*([^<]+?)\s*<span[\s\S]*?(?=dropbtnJS'|<\/body>)/g)) {
  const raw = m[1].trim();
  const district = DISTRICT_ALIAS[raw] || title(raw);
  if (!known.has(district)) unknown.push(raw);
  for (const s of m[0].matchAll(/constituency_id=\d+[^>]*>([^<]+)<\/a>/g)) seatDistrict[seatKey(s[1])] = district;
}

// The paged summary holds all 403 winners of 2022. The winners page is short but adds bye-elections, so it goes last.
let html = '';
for (let n = 1, more = true; more; n += 1) {
  const part = await page(`index.php?action=summary&subAction=winner_analyzed&sort=candidate&page=${n}`);
  html += part;
  more = part.includes(`page=${n + 1}'`);
  await new Promise((r) => setTimeout(r, 300));
}
html += await page('index.php?action=show_winners&sort=default');
const out = {};
const noDistrict = [];
let total = 0;
// Some rows lack an opening <tr>, so split on the candidate link itself
for (const row of html.split(/<a href=\/?(?:uttarpradesh2022\/)?candidate\.php\?/).slice(1)) {
  const m = row.match(/^candidate_id=(\d+)>([^<]+)<\/a>(?:<\/a>)?<b><\/td><td>([^<]+)<\/td>\s*<td>([^<]*)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([^<]*)<\/td>/);
  if (!m) continue;
  total += 1;
  const district = seatDistrict[seatKey(m[3])];
  if (!district) { noDistrict.push(m[3]); continue; }
  // MyNeta renders some rupee figures as images, those stay null and the row links to the source
  const assets = row.match(/Rs&nbsp;([\d,]+)/);
  // A bye-election winner replaces the 2022 winner of that seat
  const list = (out[district] ||= []);
  const bye = /BYE/i.test(m[3]);
  const at = list.findIndex((x) => seatKey(x.seat) === seatKey(m[3]));
  if (at >= 0 && !bye) continue;
  if (at >= 0) list.splice(at, 1);
  list.push({
    seat: title(m[3].replace(/:.*$/, '').replace(/\s*\(SC\)|\s*\(ST\)/, '')).trim(),
    name: m[2].trim(), party: m[4].trim(), cases: Number(m[5].replace(/\D/g, '')) || 0,
    edu: m[6].trim(), assets: assets ? Number(assets[1].replace(/,/g, '')) : null,
    id: Number(m[1]), bye: bye || undefined,
  });
}
Object.values(out).forEach((list) => list.sort((a, b) => (b.assets || 0) - (a.assets || 0)));
fs.mkdirSync('public/data', { recursive: true });
fs.writeFileSync('public/data/netas.json', JSON.stringify(out));

const all = Object.values(out).flat();
const tally = {};
all.forEach((s) => { tally[s.party] = (tally[s.party] || 0) + 1; });
const seen = new Set(all.map((s) => seatKey(s.seat)));
console.log({ rows: total, placed: all.length, seatsListed: Object.keys(seatDistrict).length, districts: Object.keys(out).length, withCases: all.filter((s) => s.cases).length, noAssets: all.filter((s) => s.assets == null).length, tally });
console.log({ unknown, noDistrict, missing: Object.keys(seatDistrict).filter((k) => !seen.has(k)), byes: all.filter((s) => s.bye).map((s) => s.seat) });
