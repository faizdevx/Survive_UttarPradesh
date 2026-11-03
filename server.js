// Static host plus a small caching proxy for sources that block browser requests.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

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

async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
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

const redditQueued = makeQueue(2500);

async function reddit({ subs, q }) {
  if (!/^[A-Za-z0-9_+]+$/.test(subs || '')) throw new Error('bad subreddit list');
  const url = `https://www.reddit.com/r/${subs}/search.rss?q=${encodeURIComponent(q)}&restrict_sr=1&sort=relevance&t=all&limit=20`;
  const xml = await redditQueued(() => get(url));
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
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 25).map(([, i]) => ({
    title: tag(i, 'title'), url: tag(i, 'link'), date: tag(i, 'pubDate'), source: tag(i, 'source'),
  }));
}

let overpassDownUntil = 0;

async function osm({ key, lat, lng, r }) {
  const filters = OSM[key];
  const [la, lo, ra] = [Number(lat), Number(lng), Math.min(Number(r) || 15000, 80000)];
  if (!filters || !Number.isFinite(la) || !Number.isFinite(lo)) throw new Error('bad place query');
  const body = `[out:json][timeout:25];(${filters.map((f) => `${f}(around:${ra},${la},${lo});`).join('')});out center tags 120;`;
  if (Date.now() < overpassDownUntil) return photon(key, la, lo, ra);
  try {
    const text = await get('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: body }), headers: { 'User-Agent': 'SurviveUP/0.1', Accept: '*/*' }, signal: AbortSignal.timeout(12000) });
    const found = JSON.parse(text).elements.map((e) => ({
      id: `${e.type}/${e.id}`, lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon,
      name: e.tags?.name || e.tags?.['name:en'] || null, nameHi: e.tags?.['name:hi'] || null,
      phone: e.tags?.phone || e.tags?.['contact:phone'] || null,
      site: e.tags?.website || e.tags?.['contact:website'] || null,
      kind: e.tags?.shop || e.tags?.amenity || e.tags?.leisure || e.tags?.tourism || e.tags?.historic || e.tags?.office || e.tags?.man_made || e.tags?.natural || e.tags?.waterway || null,
      addr: [e.tags?.['addr:street'], e.tags?.['addr:suburb'], e.tags?.['addr:city']].filter(Boolean).join(', ') || null,
    })).filter((p) => p.lat != null);
    return found;
  } catch {
    overpassDownUntil = Date.now() + 2 * 60 * 1000;
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
  }).filter((p) => p.km * 1000 <= radius && !seen.has(p.id) && seen.add(p.id));
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

const API = { reddit, news, osm, people };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const route = url.pathname.match(/^\/api\/(\w+)$/);
  if (route) {
    const fn = API[route[1]];
    res.setHeader('Content-Type', 'application/json');
    if (!fn) { res.writeHead(404); return res.end('{"error":"no such route"}'); }
    try {
      const params = Object.fromEntries(url.searchParams);
      const value = await cached(`${route[1]}:${url.search}`, () => fn(params));
      return res.end(JSON.stringify(value));
    } catch (err) {
      res.writeHead(502);
      return res.end(JSON.stringify({ error: err.message }));
    }
  }
  const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`Survive Uttar Pradesh on http://localhost:${PORT}`));
