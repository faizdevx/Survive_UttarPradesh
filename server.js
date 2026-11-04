// Static host plus a small caching proxy for sources that block browser requests.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fetchMplads, fetchTenders } from './scripts/mplads-lib.mjs';

const PORT = process.env.PORT || 4173;
const ROOT = path.join(import.meta.dirname, 'public');
const UA = 'Mozilla/5.0 SurviveUP/0.1 (github.com/faizdevx/Survive_UttarPradesh)';
const TTL = 10 * 60 * 1000;
const cache = new Map();

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.geojson': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };

// Overpass filters. The client picks a key, never raw query text.
const OSM = {
  chai: ['nwr["shop"="tea"]', 'nwr["amenity"="cafe"]["name"~"chai|tea|चाय",i]'],
  sutta: ['nwr["shop"="tobacco"]', 'nwr["shop"="kiosk"]'],
  cafe: ['nwr["amenity"="cafe"]'],
  park: ['nwr["leisure"="park"]["name"]', 'nwr["leisure"="track"]', 'nwr["leisure"="stadium"]'],
  gym: ['nwr["leisure"="fitness_centre"]', 'nwr["amenity"="gym"]'],
  mandi: ['nwr["amenity"="marketplace"]', 'nwr["shop"="greengrocer"]', 'nwr["name"~"mandi|मंडी",i]["landuse"!="residential"]'],
  meat: ['nwr["shop"="butcher"]', 'nwr["shop"="meat"]'],
  mall: ['nwr["shop"="mall"]', 'nwr["building"="mall"]'],
  food: ['nwr["amenity"="restaurant"]["name"]'],
  lawyer: ['nwr["office"="lawyer"]', 'nwr["amenity"="courthouse"]'],
  voter: ['nwr["office"="government"]["name"~"tehsil|tahsil|collector|election|तहसील|कलेक्ट्रेट",i]', 'nwr["amenity"="townhall"]'],
  passport: ['nwr["name"~"passport|पासपोर्ट",i]'],
  aadhaar: ['nwr["name"~"aadhaar|aadhar|आधार",i]', 'nwr["amenity"="post_office"]'],
  dm: ['nwr["name"~"collectorate|collector|district magistrate|कलेक्ट्रेट|जिलाधिकारी",i]'],
  teen: ['nwr["leisure"="park"]["name"]', 'nwr["tourism"="museum"]', 'nwr["tourism"="zoo"]', 'nwr["leisure"="water_park"]'],
  young: ['nwr["tourism"="viewpoint"]', 'nwr["man_made"="bridge"]["name"]', 'nwr["natural"="tree"]["name"]', 'nwr["tourism"="artwork"]', 'nwr["waterway"="waterfall"]', 'nwr["historic"="ruins"]', 'nwr["bridge"="yes"]["name"]["highway"]'],
  mid: ['nwr["historic"]["name"]', 'nwr["tourism"="museum"]', 'nwr["tourism"="gallery"]', 'nwr["leisure"="nature_reserve"]', 'nwr["waterway"="waterfall"]'],
  senior: ['nwr["leisure"="garden"]["name"]', 'nwr["historic"]["name"]', 'nwr["man_made"="ghat"]', 'nwr["name"~"ghat|घाट",i]["highway"!~"."]'],
  river: ['way["waterway"="river"]["name"]', 'nwr["natural"="water"]["name"]', 'nwr["name"~"ghat|घाट",i]["highway"!~"."]'],
  bridge: ['nwr["man_made"="bridge"]["name"]', 'way["bridge"="yes"]["name"]["highway"]', 'way["bridge"="yes"]["name"]["railway"]'],
  tree: ['nwr["natural"="tree"]["name"]', 'nwr["natural"="tree"]["denotation"]', 'nwr["name"~"bargad|banyan|peepal|पीपल|बरगद",i]'],
  art: ['nwr["tourism"="artwork"]', 'nwr["tourism"="gallery"]', 'nwr["shop"="art"]'],
  party: ['nwr["office"="political_party"]'],
  police: ['nwr["amenity"="police"]'],
  hospital: ['nwr["amenity"="hospital"]'],
  fashion: ['nwr["shop"="clothes"]["name"]', 'nwr["shop"="tailor"]', 'nwr["shop"="second_hand"]', 'nwr["name"~"bazaar|bazar|बाज़ार|बाजार",i]["highway"!~"."]'],
  car: ['nwr["shop"="car"]'],
};

const PHOTON = {
  chai: [['chai', 'amenity:cafe'], ['tea', 'shop:tea'], ['tea', 'amenity:cafe']],
  sutta: [['paan', 'shop:tobacco'], ['tobacco', 'shop:tobacco'], ['kiosk', 'shop:kiosk']],
  cafe: [['cafe', 'amenity:cafe'], ['coffee', 'amenity:cafe']],
  park: [['park', 'leisure:park'], ['stadium', 'leisure:stadium']],
  gym: [['gym', 'leisure:fitness_centre'], ['fitness', 'leisure:fitness_centre']],
  mandi: [['mandi'], ['market', 'amenity:marketplace'], ['sabzi', 'shop:greengrocer']],
  meat: [['meat', 'shop:butcher'], ['chicken', 'shop:butcher']],
  mall: [['mall', 'shop:mall']],
  food: [['restaurant', 'amenity:restaurant'], ['biryani', 'amenity:restaurant']],
  lawyer: [['advocate', 'office:lawyer'], ['lawyer', 'office:lawyer'], ['court', 'amenity:courthouse']],
  voter: [['tehsil'], ['collectorate'], ['election office']],
  passport: [['passport office'], ['passport seva kendra']],
  aadhaar: [['aadhaar center'], ['post office', 'amenity:post_office']],
  dm: [['collectorate'], ['district magistrate office']],
  teen: [['park', 'leisure:park'], ['museum', 'tourism:museum'], ['zoo', 'tourism:zoo']],
  young: [['viewpoint', 'tourism:viewpoint'], ['bridge', '!amenity'], ['ghat', '!amenity'], ['ruins', 'historic:ruins'], ['waterfall']],
  mid: [['fort', 'historic'], ['monument', 'historic'], ['museum', 'tourism:museum'], ['bird sanctuary']],
  senior: [['garden', 'leisure:garden'], ['ghat'], ['monument', 'historic']],
  river: [['ganga', 'waterway:river'], ['yamuna', 'waterway:river'], ['gomti', 'waterway:river'], ['ghaghara', 'waterway:river'], ['rapti', 'waterway:river'], ['betwa', 'waterway:river'], ['river', 'waterway:river'], ['ghat'], ['lake', 'natural:water']],
  bridge: [['bridge'], ['setu'], ['pul']],
  tree: [['banyan'], ['bargad'], ['peepal'], ['tree', 'natural:tree']],
  art: [['art gallery'], ['lalit kala'], ['mural'], ['artwork', 'tourism:artwork'], ['museum', 'tourism:museum']],
  party: [['party office', 'office:political_party'], ['bjp office'], ['samajwadi party office']],
  police: [['police station', 'amenity:police'], ['thana', 'amenity:police']],
  hospital: [['hospital', 'amenity:hospital'], ['medical college', 'amenity:hospital']],
  fashion: [['bazaar'], ['clothes', 'shop:clothes'], ['tailor', 'shop:tailor']],
  car: [['car showroom', 'shop:car'], ['mercedes', 'shop:car'], ['toyota', 'shop:car']],
};

const OCCUPATIONS = {
  actor: ['Q33999', 'Q10800557'], neta: ['Q82955'], business: ['Q43845', 'Q131524'], lawyer: ['Q40348'],
  music: ['Q639669', 'Q177220', 'Q36834'], art: ['Q49757', 'Q1028181', 'Q36180'],
};

const decode = (s = '') => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const tag = (block, name) => decode(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] || '');
const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

async function cached(key, fn, ttl = TTL) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  try {
    const value = await fn();
    cache.delete(key);
    cache.set(key, { at: Date.now(), value });
    // Oldest entries go first, so a stream of odd queries cannot fill the memory
    while (cache.size > 400) cache.delete(cache.keys().next().value);
    return value;
  } catch (err) {
    // An old answer beats none when a source has a bad minute
    if (hit) return hit.value;
    throw err;
  }
}

async function get(url, init = {}) {
  const r = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...init.headers }, signal: init.signal || AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${new URL(url).host} answered ${r.status}`);
  return r.text();
}

// Photon answers 503 to bursts, so calls go out one at a time.
const makeQueue = (gap) => {
  let tail = Promise.resolve();
  return (fn) => {
    const run = tail.then(fn);
    tail = run.catch(() => {}).then(() => new Promise((r) => setTimeout(r, gap)));
    return run;
  };
};
const queued = makeQueue(1100);

const redditQueued = makeQueue(4000);

async function reddit({ subs, q }) {
  if (!/^[A-Za-z0-9_+]+$/.test(subs || '')) throw new Error('bad subreddit list');
  const url = `https://www.reddit.com/r/${subs}/search.rss?q=${encodeURIComponent(q)}&restrict_sr=1&sort=relevance&t=all&limit=20`;
  const xml = await redditQueued(() => get(url).catch(async (err) => {
    if (!/429/.test(err.message)) throw err;
    await new Promise((r) => setTimeout(r, 8000));
    return get(url);
  }));
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
    title: tag(e, 'title'),
    url: e.match(/<link href="([^"]+)"/)?.[1] ? decode(e.match(/<link href="([^"]+)"/)[1]) : null,
    sub: e.match(/<category term="([^"]+)"/)?.[1] || null,
    date: tag(e, 'published') || tag(e, 'updated'),
    text: strip(tag(e, 'content')).slice(0, 280),
  })).filter((p) => p.url);
}

async function news({ q }) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`;
  const xml = await get(url);
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 100).map(([, i]) => ({
    title: tag(i, 'title'), url: tag(i, 'link'), date: tag(i, 'pubDate'), source: tag(i, 'source'),
  }));
}

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
let overpassDownUntil = 0;

async function overpass(body) {
  return Promise.any(OVERPASS.map(async (url) => JSON.parse(await get(url, { method: 'POST', body: new URLSearchParams({ data: body }), headers: { 'User-Agent': 'SurviveUP/0.1', Accept: '*/*' }, signal: AbortSignal.timeout(9000) }))));
}

async function osm({ key, lat, lng, r }) {
  const filters = OSM[key];
  const [la, lo, ra] = [Number(lat), Number(lng), Math.min(Number(r) || 15000, 80000)];
  if (!filters || !Number.isFinite(la) || !Number.isFinite(lo)) throw new Error('bad place query');
  const body = `[out:json][timeout:25];(${filters.map((f) => `${f}(around:${ra},${la},${lo});`).join('')});out center tags 120;`;
  if (Date.now() < overpassDownUntil) return photon(key, la, lo, ra);
  try {
    const found = (await overpass(body)).elements.map((e) => ({
      id: `${e.type}/${e.id}`, lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon,
      name: e.tags?.name || e.tags?.['name:en'] || null, nameHi: e.tags?.['name:hi'] || null,
      phone: e.tags?.phone || e.tags?.['contact:phone'] || null,
      site: e.tags?.website || e.tags?.['contact:website'] || null,
      kind: e.tags?.shop || e.tags?.amenity || e.tags?.leisure || e.tags?.tourism || e.tags?.historic || e.tags?.office || e.tags?.man_made || e.tags?.natural || e.tags?.waterway || null,
      addr: [e.tags?.['addr:street'], e.tags?.['addr:suburb'], e.tags?.['addr:city']].filter(Boolean).join(', ') || null,
    })).filter((p) => p.lat != null);
    return found;
  } catch {
    overpassDownUntil = Date.now() + 5 * 60 * 1000;
    return photon(key, la, lo, ra);
  }
}

// Same OpenStreetMap data through Photon, used when Overpass is overloaded. Carries no phone numbers.
async function photon(key, lat, lng, radius) {
  const lists = [];
  let failure = null;
  for (const [q, tag] of PHOTON[key] || []) {
    const url = `https://photon.komoot.io/api/?lat=${lat}&lon=${lng}&limit=50&location_bias_scale=0.1&q=${encodeURIComponent(q)}${tag ? `&osm_tag=${tag}` : ''}`;
    try { lists.push(...JSON.parse(await queued(() => get(url))).features); } catch (err) { failure = err; }
  }
  if (!lists.length && failure) throw failure;
  const seen = new Set();
  return lists.map((f) => {
    const p = f.properties;
    const [lo, la] = f.geometry.coordinates;
    return {
      id: `${p.osm_type}/${p.osm_id}`, lat: la, lng: lo, name: p.name || null, nameHi: null, phone: null, site: null,
      kind: p.osm_value || null, addr: [p.street, p.district, p.city].filter(Boolean).join(', ') || null,
      km: Math.hypot((la - lat) * 111, (lo - lng) * 111 * Math.cos(lat * Math.PI / 180)),
    };
  }).filter((p) => p.km * 1000 <= radius && !seen.has(p.id) && seen.add(p.id) && (key !== 'river' || p.kind !== 'village'));
}

async function people({ qid, type }) {
  const occ = OCCUPATIONS[type];
  if (!occ || !/^Q\d+$/.test(qid || '')) throw new Error('bad people query');
  const q = `SELECT DISTINCT ?p ?pLabel ?pDescription ?img ?s ?art WHERE {
    VALUES ?o { ${occ.map((o) => `wd:${o}`).join(' ')} }
    ?p wdt:P31 wd:Q5; wdt:P106 ?o; wdt:P19 ?pl; wikibase:sitelinks ?s.
    ?pl wdt:P131* wd:${qid}.
    OPTIONAL { ?p wdt:P18 ?img }
    OPTIONAL { ?art schema:about ?p; schema:isPartOf <https://en.wikipedia.org/> }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  } ORDER BY DESC(?s) LIMIT 24`;
  const text = await get(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`);
  const seen = new Set();
  // A person with several images comes back as several rows
  return JSON.parse(text).results.bindings.filter((b) => !seen.has(b.p.value) && seen.add(b.p.value)).map((b) => ({
    name: b.pLabel.value, about: b.pDescription?.value || '',
    img: b.img?.value ? `${b.img.value.replace('http://', 'https://')}?width=240` : null,
    url: b.art?.value || b.p.value,
  })).slice(0, 12);
}

const wikidata = async (q) => JSON.parse(await get(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`)).results.bindings;
const checkQid = (qid) => { if (!/^Q\d+$/.test(qid || '')) throw new Error('bad district id'); };
const year = (v) => v?.match(/^-?\d+/)?.[0] || null;
const firstBy = (rows, key) => { const seen = new Set(); return rows.filter((r) => !seen.has(r[key].value) && seen.add(r[key].value)); };

async function events({ qid }) {
  checkQid(qid);
  const rows = await wikidata(`SELECT ?e ?eLabel ?eDescription ?when ?art WHERE {
    ?l wdt:P131* wd:${qid}. ?e wdt:P276 ?l; wdt:P31 ?t.
    VALUES ?t { wd:Q178561 wd:Q198 wd:Q124757 wd:Q2223653 wd:Q8065 wd:Q168983 wd:Q1190554 wd:Q1656682 wd:Q13418847 wd:Q3199915 wd:Q45382 wd:Q124734 wd:Q171558 wd:Q1261499 wd:Q3241045 wd:Q7278 wd:Q273120 wd:Q131569 }
    OPTIONAL { ?e wdt:P585 ?when } OPTIONAL { ?e wdt:P580 ?when }
    OPTIONAL { ?art schema:about ?e; schema:isPartOf <https://en.wikipedia.org/> }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  } LIMIT 80`);
  return firstBy(rows, 'e').filter((b) => !/^Q\d+$/.test(b.eLabel.value)).map((b) => ({ name: b.eLabel.value, about: b.eDescription?.value || '', year: year(b.when?.value), url: b.art?.value || b.e.value }))
    .sort((a, b) => (Number(a.year) || 9999) - (Number(b.year) || 9999));
}

async function films({ qid }) {
  checkQid(qid);
  const rows = await wikidata(`SELECT ?f ?fLabel ?date ?art WHERE {
    ?l wdt:P131* wd:${qid}. { ?f wdt:P915 ?l } UNION { ?f wdt:P840 ?l }
    ?f wdt:P31 wd:Q11424.
    OPTIONAL { ?f wdt:P577 ?date }
    OPTIONAL { ?art schema:about ?f; schema:isPartOf <https://en.wikipedia.org/> }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  } LIMIT 60`);
  return firstBy(rows, 'f').map((b) => ({ name: b.fLabel.value, year: year(b.date?.value), url: b.art?.value || b.f.value })).sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
}

async function companies({ qid }) {
  checkQid(qid);
  const rows = await wikidata(`SELECT ?c ?cLabel ?cDescription ?founded ?founderLabel ?art WHERE {
    ?l wdt:P131* wd:${qid}. ?c wdt:P159 ?l; wdt:P31 ?t.
    VALUES ?t { wd:Q4830453 wd:Q6881511 wd:Q783794 wd:Q891723 wd:Q1058914 wd:Q2995256 wd:Q22687 wd:Q1616075 wd:Q1589009 wd:Q219577 wd:Q270791 }
    OPTIONAL { ?c wdt:P571 ?founded } OPTIONAL { ?c wdt:P112 ?founder }
    OPTIONAL { ?art schema:about ?c; schema:isPartOf <https://en.wikipedia.org/> }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  } LIMIT 40`);
  return firstBy(rows, 'c').map((b) => ({ name: b.cLabel.value, about: b.cDescription?.value || '', year: year(b.founded?.value), founder: b.founderLabel?.value || null, url: b.art?.value || b.c.value }));
}

const coords = ({ lat, lng }) => {
  const [la, lo] = [Number(lat), Number(lng)];
  if (!Number.isFinite(la) || !Number.isFinite(lo)) throw new Error('bad location');
  return [la, lo];
};

// Wikipedia articles with coordinates, nearest first
async function nearby(params) {
  const [la, lo] = coords(params);
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&generator=geosearch&ggscoord=${la}|${lo}&ggsradius=10000&ggslimit=50&prop=coordinates|pageimages|description&colimit=50&piprop=thumbnail&pithumbsize=200&pilimit=50`;
  const pages = Object.values(JSON.parse(await get(url)).query?.pages || {});
  return pages.filter((p) => p.coordinates).sort((a, b) => a.index - b.index).map((p) => ({
    id: String(p.pageid), name: p.title, about: p.description || '', img: p.thumbnail?.source || null,
    lat: p.coordinates[0].lat, lng: p.coordinates[0].lon, url: `https://en.wikipedia.org/?curid=${p.pageid}`,
  }));
}

async function weather(params) {
  const [la, lo] = coords(params);
  const [w, a] = await Promise.all([
    get(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m`),
    get(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${la}&longitude=${lo}&current=us_aqi,pm2_5`),
  ]);
  const cw = JSON.parse(w).current;
  const ca = JSON.parse(a).current;
  return { temp: cw.temperature_2m, feels: cw.apparent_temperature, code: cw.weather_code, wind: cw.wind_speed_10m, aqi: ca.us_aqi, pm25: ca.pm2_5 };
}

// Counts names in headlines. This measures press attention, not support or population.
const METERS = {
  party: {
    query: (p) => `${p} (BJP OR "Samajwadi Party" OR Congress OR BSP OR RLD) when:30d`,
    names: { BJP: /\bBJP\b/, SP: /Samajwadi|Akhilesh|\bSP (?:chief|MP|MLA|leader|candidate|worker|workers|govt|government|supremo)\b/, INC: /Congress|\bINC\b|Rahul Gandhi/, BSP: /\bBSP\b|Mayawati/, RLD: /\bRLD\b|Jayant Chaudhary/ },
  },
  samaj: {
    query: (p) => `${p} (caste OR Yadav OR Dalit OR Jat OR Thakur OR Brahmin OR Muslim OR Kurmi OR Nishad OR Gurjar) (vote OR politics OR election) when:90d`,
    names: { Muslim: /Muslim/i, Dalit: /Dalit|Jatav|Pasi/i, Yadav: /Yadavs\b|Yadav (?:vote|voter|community|samaj)|Muslim-Yadav/, Brahmin: /Brahmin/i, Thakur: /Thakurs\b|Thakur (?:vote|voter|community|samaj)|Rajput/, Jat: /\bJats\b|\bJat (?:vote|voter|community|samaj|leader|belt)/, Kurmi: /Kurmi/i, Nishad: /Nishads\b|Nishad (?:vote|voter|community|samaj)/, Gurjar: /Gurjars\b|Gujjars\b|(?:Gurjar|Gujjar) (?:vote|voter|community|samaj)/ },
  },
};
async function meter({ place, kind }) {
  const m = METERS[kind];
  if (!m || !place) throw new Error('bad meter query');
  const items = await news({ q: m.query(place) });
  const counts = Object.fromEntries(Object.entries(m.names).map(([k, re]) => [k, items.filter((n) => re.test(n.title)).length]));
  return { total: items.length, counts };
}

const crore = (title) => {
  const m = title.match(/(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)\s*-?\s*(lakh\s*crore|crore|cr\b|lakh|billion)/i);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  const unit = m[2].toLowerCase().replace(/\s+/g, ' ');
  return unit === 'lakh crore' ? n * 1e5 : unit === 'lakh' ? n / 100 : unit === 'billion' ? n * 100 : n;
};
const PAYERS = [
  ['Centre', /\bcentre\b|central govt|union|\bPM\b|modi|NHAI|railway|gadkari/i],
  ['State', /\bCM\b|yogi|adityanath|state govt|UP govt|U\.?P\.? government|UPEIDA|cabinet/i],
  ['Local body', /nagar nigam|municipal|development authority|\b[A-Z]DA\b|panchayat|MLA fund|MPLAD|smart city/i],
];
async function money({ place }) {
  if (!place) throw new Error('bad money query');
  const items = await news({ q: `${place} crore (project OR scheme OR sanctioned OR budget OR inaugurated) when:90d` });
  const seen = new Set();
  return items.map((n) => ({ ...n, crore: crore(n.title), payer: PAYERS.find(([, re]) => re.test(n.title))?.[0] || 'Not stated' }))
    .filter((n) => n.crore && !seen.has(n.title) && seen.add(n.title)).sort((a, b) => b.crore - a.crore).slice(0, 15);
}

// Pins a headline to a named place inside it when Photon can find one close to the city.
const nearHere = async (name, la, lo, km) => {
  const url = `https://photon.komoot.io/api/?lat=${la}&lon=${lo}&limit=3&location_bias_scale=0.1&osm_tag=place&q=${encodeURIComponent(name)}`;
  const hits = JSON.parse(await queued(() => get(url))).features;
  const hit = hits.find((f) => f.properties.name?.toLowerCase() === name.toLowerCase());
  if (!hit) return null;
  const [lng, lat] = hit.geometry.coordinates;
  return Math.hypot((lat - la) * 111, (lng - lo) * 111 * Math.cos(la * Math.PI / 180)) <= km ? { lat, lng } : null;
};
async function geonews(params) {
  const [la, lo] = coords(params);
  const items = (await news({ q: params.q })).slice(0, 10);
  const city = String(params.city || '').toLowerCase().split(' ')[0];
  const out = [];
  for (const n of items) {
    // The source name sits after the last dash in a Google News title
    const head = n.title.replace(/\s-\s[^-]*$/, '');
    const name = head.match(/\b(?:in|at|near|from)\s+([A-Z][a-z]{3,}(?:\s[A-Z][a-z]{3,})?)/)?.[1];
    let at = null;
    if (name && !name.toLowerCase().includes(city)) {
      try { at = await nearHere(name, la, lo, 35); } catch { /* Photon busy, the pin stays on the city */ }
    }
    out.push({ url: n.url, place: at ? name : null, ...at });
  }
  return out;
}

async function locality(params) {
  const [la, lo] = coords(params);
  const p = JSON.parse(await get(`https://photon.komoot.io/reverse?lat=${la}&lon=${lo}&limit=1`)).features[0]?.properties;
  return { name: p?.district || p?.locality || p?.suburb || p?.name || null, city: p?.city || null };
}

// Search for a place inside Uttar Pradesh
async function geocode({ q }) {
  if (!q || q.length < 2) throw new Error('type a place name');
  const url = `https://photon.komoot.io/api/?limit=6&bbox=77,23.8,84.7,30.5&q=${encodeURIComponent(q)}`;
  return JSON.parse(await queued(() => get(url))).features
    .filter((f) => !f.properties.state || /uttar pradesh/i.test(f.properties.state))
    .map((f) => {
      const p = f.properties;
      return { name: p.name || q, label: [p.district || p.locality, p.city, p.county].filter(Boolean).join(', '), lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] };
    });
}

// MyNeta opens a folder per election. Its missing page still answers 200.
async function candidates() {
  const html = await get('https://www.myneta.info/uttarpradesh2027/');
  return { ready: !/Page Not Found/i.test(html), url: 'https://www.myneta.info/uttarpradesh2027/' };
}

// Live airport readings. Only these UP airports have records in the Iowa archive.
const AIRPORTS = { VILK: 'Lucknow', VEBN: 'Varanasi', VEAY: 'Ayodhya' };
async function kohraobs() {
  const fmt = (t) => [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
  const [y1, m1, d1] = fmt(new Date(Date.now() - 36 * 3600000));
  const [y2, m2, d2] = fmt(new Date(Date.now() + 24 * 3600000));
  const out = [];
  // The archive asks for one request at a time
  for (const [id, district] of Object.entries(AIRPORTS)) {
    const u = `https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?station=${id}&data=vsby&data=wxcodes&year1=${y1}&month1=${m1}&day1=${d1}&year2=${y2}&month2=${m2}&day2=${d2}&tz=UTC&format=onlycomma&latlon=no&missing=empty&trace=empty&direct=no&report_type=3&report_type=4`;
    try {
      const rows = (await get(u, { signal: AbortSignal.timeout(40000) })).trim().split('\n').slice(1).map((l) => l.split(',')).filter((c) => c[2] !== '');
      const last = rows[rows.length - 1];
      if (last) out.push({ id, district, at: `${last[1].replace(' ', 'T')}:00Z`, metres: Math.round(Number(last[2]) * 1609.34), wx: last[3] || '' });
    } catch { /* one quiet airport should not lose the others */ }
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (!out.length) throw new Error('the airport archive did not answer');
  return { fetchedAt: new Date().toISOString(), source: 'https://mesonet.agron.iastate.edu/request/download.phtml', stations: out };
}

// One archive date per half year, plus the newest
async function wayback() {
  const cfg = JSON.parse(await get('https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json'));
  const all = Object.entries(cfg).map(([id, v]) => ({ id, meta: v.metadataLayerUrl, date: v.itemTitle.match(/\d{4}-\d{2}-\d{2}/)?.[0] })).filter((r) => r.date).sort((a, b) => a.date.localeCompare(b.date));
  const seen = new Set();
  const picked = all.filter((r) => {
    const half = `${r.date.slice(0, 4)}-${Number(r.date.slice(5, 7)) <= 6 ? 1 : 2}`;
    return !seen.has(half) && seen.add(half);
  });
  if (picked[picked.length - 1] !== all[all.length - 1]) picked.push(all[all.length - 1]);
  return picked;
}

// Esri's own record of when each photo was really taken at this spot
async function samayhere(params) {
  const [la, lo] = coords(params);
  // Each lookup makes dozens of calls to Esri, so it only answers for UP and nearby
  if (la < 23 || la > 31.5 || lo < 76 || lo > 85.5) throw new Error('photo dates are only available around Uttar Pradesh');
  const stops = await cached('wayback:list', wayback, 24 * 3600000);
  const ask = async (s) => {
    for (const layer of [6, 7, 5]) {
      const u = `${s.meta}/${layer}/query?geometry=${lo},${la}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=SRC_DATE,SRC_RES,SRC_DESC&returnGeometry=false&f=json`;
      try {
        const a = JSON.parse(await get(u, { signal: AbortSignal.timeout(15000) })).features?.[0]?.attributes;
        if (a?.SRC_DATE) {
          const d = String(a.SRC_DATE);
          return { id: s.id, archived: s.date, photo: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, res: a.SRC_RES, sat: a.SRC_DESC };
        }
      } catch { /* next layer */ }
    }
    return { id: s.id, archived: s.date, photo: null };
  };
  const results = [];
  for (let i = 0; i < stops.length; i += 5) results.push(...await Promise.all(stops.slice(i, i + 5).map(ask)));
  const dated = results.filter((r) => r.photo);
  if (!dated.length) return { dated: false, stops: results };
  // Archive dates can show the same photo many times, so each real photo appears once
  const seen = new Map();
  dated.forEach((r) => { if (!seen.has(r.photo)) seen.set(r.photo, r); });
  return { dated: true, stops: [...seen.values()].sort((a, b) => a.photo.localeCompare(b.photo)) };
}

// Radio Browser asks clients to try its mirrors in turn
const RADIO_HOSTS = ['de1', 'at1', 'nl1', 'fi1'];
async function radioSearch(query) {
  let failure;
  for (const host of RADIO_HOSTS) {
    try {
      return JSON.parse(await get(`https://${host}.api.radio-browser.info/json/stations/search?${query}&hidebroken=true&limit=30&order=votes&reverse=true`, { signal: AbortSignal.timeout(10000) }));
    } catch (err) { failure = err; }
  }
  throw failure;
}
const NATIONAL = /^Vividh Bharati$|Akashvani AIR FM Gold|All India Radio News|Fm Gold Delhi|FM Rainbow Delhi|Radio Mirchi Hindi/i;
async function radio() {
  const local = await radioSearch('country=India&state=Uttar%20Pradesh');
  const cities = await Promise.all(['Lucknow', 'Agra', 'Varanasi', 'Kanpur', 'Prayagraj', 'Allahabad', 'Gorakhpur', 'Meerut'].map((c) => radioSearch(`countrycode=IN&name=${c}`).catch(() => [])));
  const bhojpuri = (await Promise.all(['countrycode=IN&name=Bhojpuri', 'language=bhojpuri', 'tag=bhojpuri'].map((q) => radioSearch(q).catch(() => [])))).flat();
  const national = (await Promise.all(['Vividh Bharati', 'Akashvani', 'AIR FM', 'All India Radio', 'Radio Mirchi'].map((n) => radioSearch(`countrycode=IN&name=${encodeURIComponent(n)}`).catch(() => [])))).flat().filter((s) => NATIONAL.test(s.name.trim()));
  const seen = new Set();
  const band = (band, list) => list.map((s) => ({ band, name: s.name.trim(), url: s.url_resolved }));
  // https only, so the stations also play once the site is hosted
  const list = [...band('Listed as UP', [...local, ...cities.flat()]), ...band('Bhojpuri', bhojpuri), ...band('National', national)]
    .filter((s) => s.url?.startsWith('https://') && !seen.has(s.name.toLowerCase()) && seen.add(s.name.toLowerCase()));
  const alive = async (s) => {
    try {
      const r = await fetch(s.url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(7000) });
      const type = r.headers.get('content-type') || '';
      r.body?.cancel().catch(() => {});
      return r.ok && /audio|mpegurl|ogg|aac|octet-stream/i.test(type) && !/mpegurl/i.test(type);
    } catch { return false; }
  };
  const out = [];
  for (let i = 0; i < list.length; i += 5) {
    const batch = list.slice(i, i + 5);
    const ok = await Promise.all(batch.map(alive));
    batch.forEach((s, k) => { if (ok[k]) out.push({ ...s, checkedAt: new Date().toISOString() }); });
  }
  if (!out.length) throw new Error('no station answered the check');
  return out;
}

// Forecast visibility alone misses most fog here: in a test across all districts, 95 of 105 calm
// hours near saturation still read 2 km or more. So near-saturated calm air also raises the risk.
function fogLevel({ vis, temp, rh, gap, wind, hour, month }) {
  const foggyMonths = month >= 10 || month <= 3;
  const night = hour >= 20 || hour <= 10;
  const air = foggyMonths && night && temp < 24;
  if (vis < 200 || (air && gap <= 0.5 && rh >= 97 && wind <= 6)) return 3;
  if (vis < 500 || (air && gap <= 1 && rh >= 95 && wind <= 8)) return 2;
  if (vis < 1000 || (air && gap <= 2 && rh >= 90 && wind <= 10)) return 1;
  return 0;
}

async function kohra() {
  const list = Object.values(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/districts.json')))).filter((d) => d.lat != null);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${list.map((d) => d.lat).join(',')}&longitude=${list.map((d) => d.lng).join(',')}&hourly=visibility,temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,wind_speed_10m&forecast_days=3&timezone=Asia%2FKolkata`;
  const all = JSON.parse(await get(url));
  // Open-Meteo gives India time without an offset, so "now" has to be worked out the same way
  const now = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 13);
  const first = Math.max(0, all[0].hourly.time.findIndex((t) => t.slice(0, 13) === now));
  const pick = (a) => a.slice(first, first + 48);
  const d = {};
  list.forEach((x, i) => {
    const h = all[i].hourly;
    const levels = pick(h.time).map((t, k) => fogLevel({
      vis: pick(h.visibility)[k], temp: pick(h.temperature_2m)[k], rh: pick(h.relative_humidity_2m)[k],
      gap: pick(h.temperature_2m)[k] - pick(h.dew_point_2m)[k], wind: pick(h.wind_speed_10m)[k],
      hour: Number(t.slice(11, 13)), month: Number(t.slice(5, 7)),
    }));
    d[x.name] = { f: levels.join(''), t: pick(h.temperature_2m).map(Math.round), a: pick(h.apparent_temperature).map(Math.round), v: pick(h.visibility).map((v) => Math.round(v / 100) / 10) };
  });
  return { at: new Date().toISOString(), hours: pick(all[0].hourly.time), d };
}

// The portal's answer is 14 MB, so a saved copy is served at once and refreshed behind the scenes.
const MPLADS_CACHE = path.join(import.meta.dirname, '.cache', 'mplads.json');
const MPLADS_EVERY = 6 * 60 * 60 * 1000;
let mpladsBusy = false;
function refreshMplads() {
  if (mpladsBusy) return;
  mpladsBusy = true;
  const known = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/districts.json'))));
  fetchMplads(known).then((data) => {
    fs.mkdirSync(path.dirname(MPLADS_CACHE), { recursive: true });
    fs.writeFileSync(MPLADS_CACHE, JSON.stringify(data));
  }).catch((err) => console.error('MPLADS refresh failed:', err.message)).finally(() => { mpladsBusy = false; });
}
async function mplads() {
  const file = fs.existsSync(MPLADS_CACHE) ? MPLADS_CACHE : path.join(ROOT, 'data/hisaab-mplads.json');
  const data = JSON.parse(fs.readFileSync(file));
  if (Date.now() - Date.parse(data.fetchedAt) > MPLADS_EVERY) refreshMplads();
  return data;
}

const TTLS = { kohraobs: 20 * 60 * 1000, samayhere: 6 * 60 * 60 * 1000, radio: 30 * 60 * 1000, kohra: 60 * 60 * 1000, mplads: 30 * 1000, tenders: 15 * 60 * 1000 };

const API = { kohraobs, samayhere, tenders: fetchTenders, mplads, kohra, reddit, news, osm, people, events, films, companies, nearby, weather, meter, money, geonews, locality, geocode, candidates, wayback, radio };

// Each visitor gets a fair share of the calls this server makes to free public services
const HITS = new Map();
const LIMIT_PER_MINUTE = 150;
function overLimit(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const now = Date.now();
  const hit = HITS.get(ip);
  if (!hit || now - hit.since > 60000) {
    HITS.delete(ip);
    HITS.set(ip, { since: now, n: 1 });
    if (HITS.size > 5000) HITS.delete(HITS.keys().next().value);
    return false;
  }
  hit.n += 1;
  return hit.n > LIMIT_PER_MINUTE;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  let url;
  let rel;
  // A malformed address must not be able to bring the site down
  try {
    url = new URL(req.url, 'http://x');
    rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  } catch {
    res.writeHead(400);
    return res.end('Bad request');
  }
  const route = url.pathname.match(/^\/api\/(\w+)$/);
  if (route) {
    const fn = Object.hasOwn(API, route[1]) ? API[route[1]] : null;
    res.setHeader('Content-Type', 'application/json');
    if (!fn) { res.writeHead(404); return res.end('{"error":"no such route"}'); }
    if (url.search.length > 600) { res.writeHead(414); return res.end('{"error":"request too long"}'); }
    if (overLimit(req)) { res.writeHead(429, { 'Retry-After': '60' }); return res.end('{"error":"too many requests, try again in a minute"}'); }
    try {
      const params = Object.fromEntries(url.searchParams);
      const value = await cached(`${route[1]}:${url.search}`, () => fn(params), TTLS[route[1]]);
      return res.end(JSON.stringify(value));
    } catch (err) {
      res.writeHead(502);
      return res.end(JSON.stringify({ error: err.message }));
    }
  }
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(file);
    const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream', Vary: 'Accept-Encoding' };
    if (ext === '.jpg') headers['Cache-Control'] = 'public, max-age=86400';
    // Text compresses well, which matters for the seat map on a phone
    if (ext !== '.jpg' && ext !== '.png' && /gzip/.test(req.headers['accept-encoding'] || '')) {
      headers['Content-Encoding'] = 'gzip';
      res.writeHead(200, headers);
      return res.end(zlib.gzipSync(data));
    }
    res.writeHead(200, headers);
    res.end(data);
  });
});

// One failed background job should never take the site down
process.on('unhandledRejection', (err) => console.error('Unhandled:', err));
server.listen(PORT, () => console.log(`Survive Uttar Pradesh on http://localhost:${PORT}`));
