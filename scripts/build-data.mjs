// Builds public/data/districts.json + simplified GeoJSON from Wikipedia and Wikidata.
// Run with: node scripts/build-data.mjs
import fs from 'node:fs';

const UA = { 'User-Agent': 'SurviveUP/0.1 (github.com/faizdevx/Survive_UttarPradesh)' };
const wikitext = async (page) => {
  const r = await fetch(`https://en.wikipedia.org/w/api.php?action=parse&format=json&prop=wikitext&page=${page}`, { headers: UA });
  return (await r.json()).parse.wikitext['*'];
};

// District -> Lok Sabha seats whose area covers most of it. First seat is the primary one.
const SEATS = {
  Saharanpur: ['Saharanpur'], Shamli: ['Kairana'], Muzaffarnagar: ['Muzaffarnagar'], Bijnor: ['Bijnor', 'Nagina'],
  Moradabad: ['Moradabad'], Rampur: ['Rampur'], Sambhal: ['Sambhal'], Amroha: ['Amroha'], Meerut: ['Meerut'],
  Baghpat: ['Baghpat'], Ghaziabad: ['Ghaziabad'], Hapur: ['Meerut', 'Amroha'], 'Gautam Buddha Nagar': ['GB Nagar'],
  Bulandshahr: ['Bulandshahr'], Aligarh: ['Aligarh'], Hathras: ['Hathras'], Mathura: ['Mathura'],
  Agra: ['Agra', 'Fatehpur Sikri'], Firozabad: ['Firozabad'], Mainpuri: ['Mainpuri'], Etah: ['Etah'], Kasganj: ['Etah'],
  Budaun: ['Budaun', 'Aonla'], Bareilly: ['Bareilly', 'Aonla'], Pilibhit: ['Pilibhit'], Shahjahanpur: ['Shahjahanpur'],
  'Lakhimpur Kheri': ['Kheri', 'Dhaurahra'], Sitapur: ['Sitapur', 'Dhaurahra'], Hardoi: ['Hardoi', 'Misrikh'], Unnao: ['Unnao'],
  Lucknow: ['Lucknow', 'Mohanlalganj'], 'Rae Bareli': ['Rae Bareli'], Amethi: ['Amethi'], Sultanpur: ['Sultanpur'],
  Pratapgarh: ['Pratapgarh'], Farrukhabad: ['Farrukhabad'], Etawah: ['Etawah'], Auraiya: ['Etawah'], Kannauj: ['Kannauj'],
  'Kanpur Nagar': ['Kanpur', 'Akbarpur'], 'Kanpur Dehat': ['Akbarpur'], Jalaun: ['Jalaun'], Jhansi: ['Jhansi'], Lalitpur: ['Jhansi'],
  Hamirpur: ['Hamirpur'], Mahoba: ['Hamirpur'], Banda: ['Banda'], Chitrakoot: ['Banda'], Fatehpur: ['Fatehpur'],
  Kaushambi: ['Kaushambi'], Prayagraj: ['Allahabad', 'Phulpur'], Barabanki: ['Barabanki'], Ayodhya: ['Faizabad'],
  'Ambedkar Nagar': ['Ambedkar Nagar'], Bahraich: ['Bahraich'], Shrawasti: ['Shrawasti'], Balrampur: ['Shrawasti'],
  Gonda: ['Gonda', 'Kaiserganj'], Maharajganj: ['Maharajganj'], Siddharthnagar: ['Domariyaganj'], Basti: ['Basti'],
  'Sant Kabir Nagar': ['Sant Kabir Nagar'], Gorakhpur: ['Gorakhpur', 'Bansgaon'], Kushinagar: ['Kushi Nagar'],
  Deoria: ['Deoria', 'Salempur'], Azamgarh: ['Azamgarh', 'Lalganj'], Mau: ['Ghosi'], Ballia: ['Ballia', 'Salempur'],
  Jaunpur: ['Jaunpur', 'Machhlishahr'], Ghazipur: ['Ghazipur'], Chandauli: ['Chandauli'], Varanasi: ['Varanasi'],
  Bhadohi: ['Bhadohi'], Mirzapur: ['Mirzapur'], Sonbhadra: ['Robertsganj'],
};

const PARTY = {
  'National Democratic Alliance': 'BJP', 'Bharatiya Janata Party': 'BJP', 'Bhartiya Janata Party': 'BJP', 'Samajwadi Party': 'SP', 'Indian National Congress': 'INC', 'Rashtriya Lok Dal': 'RLD',
  'Apna Dal (Soneylal)': 'ADS', 'Apna Dal (Sonelal)': 'ADS', 'Aazad Samaj Party (Kanshi Ram)': 'ASP', 'Azad Samaj Party (Kanshi Ram)': 'ASP',
};

// Lok Sabha winners
const ls = await wikitext('2024_Indian_general_election_in_Uttar_Pradesh');
const start = ls.indexOf('=== Results by constituency ===');
const table = ls.slice(start, ls.indexOf('== Assembly wise lead', start));
const winners = {};
const clean = (c) => c.replace(/\{\{.*?\}\}/g, '').replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1').replace(/<[^>]+>/g, '').trim();
const seatKey = (s) => s.toLowerCase().replace(/[^a-z]/g, '').replace('badaun', 'budaun').replace('shravasti', 'shrawasti').replace('kushinagar', 'kushinagar');
for (const row of table.split(/\n\|-/)) {
  const seat = row.match(/\[\[[^\]|]*Lok Sabha constituency\|([^\]]+)\]\]/);
  if (!seat) continue;
  const cells = row.split('\n').filter((l) => l.startsWith('|')).map((l) => l.slice(1).trim());
  const pollIdx = cells.findIndex((c, i) => i > 0 && /^\d+\.\d+/.test(c));
  // Party cells span rows, so the coloured margin cell is the reliable winner marker
  const colours = [...row.matchAll(/party colou?r\|([^}]+)\}\}/gi)].map((m) => m[1].trim());
  const partyName = colours[colours.length - 1];
  winners[seatKey(seat[1])] = { seat: seat[1], party: PARTY[partyName] || partyName, mp: clean(cells[pollIdx + 1] || '') || null };
}

// Census 2011 Muslim share by district
const isl = await wikitext('Islam_in_Uttar_Pradesh');
const census = {};
for (const row of isl.slice(isl.indexOf('=== Population by district')).split(/\n\|-/)) {
  const m = row.match(/\n\|\s*\[\[(?:[^\]|]*\|)?([^\]]+)\]\](?:\s*\(\[\[([^\]]+)\]\]\))?\s*\n\|([\d,]+)\n\|([\d,]+)/);
  if (!m) continue;
  const n = (s) => Number(s.replace(/,/g, ''));
  const entry = { pop: n(m[3]), muslim: n(m[4]), share: +(100 * n(m[4]) / n(m[3])).toFixed(1) };
  census[m[1].trim()] = entry;
  if (m[2]) census[m[2].trim()] = entry;
}
const CENSUS_ALIAS = {
  'Gautam Buddha Nagar': ['Gautam Budh Nagar', 'Gautam Buddh Nagar', 'Gautam Buddha Nagar district'], 'Lakhimpur Kheri': ['Kheri', 'Lakhimpur'],
  Ayodhya: ['Faizabad'], Prayagraj: ['Allahabad'], Kasganj: ['Kanshiram Nagar', 'Kanshi Ram Nagar'], Amroha: ['Jyotiba Phule Nagar'],
  Amethi: ['Chhatrapati Shahuji Maharaj Nagar'], Hathras: ['Mahamaya Nagar'], Bhadohi: ['Sant Ravidas Nagar'],
  Shrawasti: ['Shravasti'], Budaun: ['Badaun'], Siddharthnagar: ['Siddharth Nagar'], Maharajganj: ['Mahrajganj'],
  Kushinagar: ['Kushi Nagar'],
};

// Headquarters city with Hindi and Urdu names from Wikidata
const sparql = `SELECT ?d ?dLabel ?c ?cen ?chi ?cur ?coord WHERE {
  ?d wdt:P31 wd:Q1149652; wdt:P131 ?div; wdt:P36 ?c.
  { ?d wdt:P131 wd:Q1498 } UNION { ?div wdt:P131 wd:Q1498 }
  ?c wdt:P625 ?coord.
  OPTIONAL { ?c rdfs:label ?cen FILTER(LANG(?cen)="en") }
  OPTIONAL { ?c rdfs:label ?chi FILTER(LANG(?chi)="hi") }
  OPTIONAL { ?c rdfs:label ?cur FILTER(LANG(?cur)="ur") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
const wd = await (await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, { headers: UA })).json();
const norm = (s) => s.toLowerCase().replace(/ district.*$/, '').replace(/[^a-z]/g, '');
const WD_ALIAS = {
  lakhimpurkheri: ['kheri', 'lakhimpur'], ayodhya: ['faizabad'], prayagraj: ['allahabad'], budaun: ['badaun'],
  gautambuddhanagar: ['gautambudhnagar', 'gautambuddhnagar'], shrawasti: ['shravasti'], siddharthnagar: ['siddharthanagar'],
  bhadohi: ['santravidasnagar'], amroha: ['jyotibaphulenagar'], maharajganj: ['mahrajganj'], raebareli: ['raibareilly', 'raebareilly'],
};
const byName = {};
for (const b of wd.results.bindings) {
  const [lng, lat] = b.coord.value.match(/-?[\d.]+/g).map(Number);
  byName[norm(b.dLabel.value)] ??= { qid: b.d.value.split('/').pop(), city: { en: b.cen?.value, hi: b.chi?.value, ur: b.cur?.value }, lat, lng };
}

byName.baghpat ??= { qid: 'Q2085367', city: { en: 'Baghpat', hi: 'बागपत', ur: 'باغپت' }, lat: 28.944, lng: 77.218 };
byName.siddharthnagar ??= { qid: null, city: { en: 'Siddharthnagar', hi: 'सिद्धार्थनगर', ur: 'سدھارتھ نگر' }, lat: 27.3, lng: 83.07 };

const geo = JSON.parse(fs.readFileSync('data/up-raw.geojson'));
const out = {};
const report = { noWinner: [], noCensus: [], noCity: [] };
for (const f of geo.features) {
  const name = f.properties.district;
  const seats = (SEATS[name] || []).map((s) => ({ seat: s, ...winners[seatKey(s)] }));
  if (!seats.length || seats.some((s) => !s.party)) report.noWinner.push(name);
  const c = census[name] || (CENSUS_ALIAS[name] || []).map((a) => census[a]).find(Boolean) || null;
  if (!c) report.noCensus.push(name);
  const key = norm(name);
  const w = byName[key] || (WD_ALIAS[key] || []).map((a) => byName[a]).find(Boolean) || null;
  if (!w) report.noCity.push(name);
  out[name] = { name, seats, census: c, qid: w?.qid || null, city: w?.city || { en: name }, lat: w?.lat ?? null, lng: w?.lng ?? null };
}

// Round coordinates to shrink the map file
const round = (a) => (typeof a[0] === 'number' ? [+a[0].toFixed(3), +a[1].toFixed(3)] : a.map(round));
geo.features = geo.features.map((f) => ({ type: 'Feature', properties: { district: f.properties.district }, geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) } }));
fs.mkdirSync('public/data', { recursive: true });
fs.writeFileSync('public/data/up.geojson', JSON.stringify(geo));
fs.writeFileSync('public/data/districts.json', JSON.stringify(out, null, 1));
const tally = {};
Object.values(winners).forEach((w) => { tally[w.party] = (tally[w.party] || 0) + 1; });
console.log('seats', Object.keys(winners).length, tally);
console.log(report);
console.log(JSON.stringify(out.Lucknow));

