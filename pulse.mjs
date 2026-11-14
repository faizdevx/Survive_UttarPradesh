// Aas-paas: one-tap reports of daily problems (power, water, network, roads, traffic, safety) and photo cases for roads.
// Everything is kept in one JSON file plus a photo folder. Point DATA_DIR at a Railway volume so it survives deploys.
// shortcut: one file and one process, fine to some thousands of reports a day. Move to SQLite or Postgres beyond that.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const HERE = import.meta.dirname;
const DIR = process.env.DATA_DIR || path.join(HERE, 'data', 'pulse');
const PHOTOS = path.join(DIR, 'photos');
const FILE = path.join(DIR, 'pulse.json');
fs.mkdirSync(PHOTOS, { recursive: true });

const MIN = 60000;
// How long one tap counts. Power and network change by the hour, roads by the month.
export const TOPICS = {
  bijli: { ttl: 3 * 60 * MIN },
  paani: { ttl: 6 * 60 * MIN },
  net: { ttl: 2 * 60 * MIN, subs: ['jio', 'airtel', 'vi', 'bsnl'] },
  jam: { ttl: 45 * MIN, subs: ['jam', 'band'] },
  suraksha: { ttl: 7 * 24 * 60 * MIN, subs: ['andhera', 'asurakshit'] },
};
export const KINDS = ['gaddha', 'naali', 'khamba', 'kooda'];
const NEAR_KM = 2;
const CASE_KM = 3;
const FIXED_VOTES = 3;

const seats = JSON.parse(fs.readFileSync(path.join(HERE, 'public/data/seats.json'), 'utf8'));
const shapes = JSON.parse(fs.readFileSync(path.join(HERE, 'public/data/seats.geojson'), 'utf8')).features.map((f) => {
  const polys = f.geometry.coordinates.map((p) => p[0]);
  const xs = polys.flat().map((p) => p[0]);
  const ys = polys.flat().map((p) => p[1]);
  return { no: f.properties.no, polys, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
});

function inRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// The smallest matching ring wins, because some seats sit inside another seat's outline
export function seatAt(lat, lng) {
  let best = null;
  let size = Infinity;
  for (const s of shapes) {
    const [x0, y0, x1, y1] = s.box;
    if (lng < x0 || lng > x1 || lat < y0 || lat > y1) continue;
    for (const ring of s.polys) {
      if (!inRing(lng, lat, ring)) continue;
      const area = (x1 - x0) * (y1 - y0);
      if (area < size) { size = area; best = s.no; }
    }
  }
  return best && seats[best];
}

const km = (a, b) => {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  return Math.hypot(x, (b.lat - a.lat) * r) * 6371;
};

// Store
let db = { taps: [], cases: [] };
try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { /* first run */ }
let dirty = false;
function save() {
  if (!dirty) return;
  dirty = false;
  const now = Date.now();
  db.taps = db.taps.filter((t) => now - t.at < TOPICS[t.topic].ttl);
  fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(db));
  fs.renameSync(`${FILE}.tmp`, FILE);
}
setInterval(save, 20000).unref();
process.on('SIGTERM', () => { save(); process.exit(0); });

// Each phone gets a random id on first open. The server keeps only a hash of it, never a name or number.
const who = (device) => crypto.createHash('sha256').update(String(device)).digest('hex').slice(0, 16);
// Taps are stored about 100 m off the true spot. Safety taps are coarser, about 500 m, so nobody can be traced home.
const blur = (n, step) => Math.round(n / step) * step;
const place = (lat, lng) => {
  const s = seatAt(lat, lng);
  return s ? { seat: s.no, seatName: s.name, district: s.district, mla: s.mla?.name || null, mlaParty: s.mla?.party || null } : null;
};

const COUNTS = new Map();
function allowed(key, max, windowMs) {
  const now = Date.now();
  const list = (COUNTS.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) return false;
  list.push(now);
  COUNTS.set(key, list);
  if (COUNTS.size > 50000) COUNTS.delete(COUNTS.keys().next().value);
  return true;
}

// Reports must carry a fresh GPS fix from the phone. A picked district has none, so it can look but not report.
// shortcut: a determined person can fake GPS in the browser. This stops casual reports for other places, not spoofing.
const MAX_ACC = 1000;
function check(body) {
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const acc = Number(body.acc);
  if (body.gps !== true || !(acc > 0 && acc <= MAX_ACC)) throw Object.assign(new Error('Reports need your live location. Tap "Use my location" first.'), { status: 403 });
  if (!(lat > 23.8 && lat < 30.5 && lng > 77 && lng < 84.7)) throw Object.assign(new Error('Location is outside Uttar Pradesh'), { status: 400 });
  if (!/^[a-z0-9-]{16,64}$/.test(String(body.device || ''))) throw Object.assign(new Error('Bad device id'), { status: 400 });
  const at = place(lat, lng);
  if (!at) throw Object.assign(new Error('Location is outside Uttar Pradesh'), { status: 400 });
  return { lat, lng, at, me: who(body.device) };
}

export function tap(body, ip) {
  const { lat, lng, at, me } = check(body);
  const topic = TOPICS[body.topic];
  if (!topic) throw Object.assign(new Error('Unknown topic'), { status: 400 });
  const sub = topic.subs ? String(body.sub || '') : '';
  if (topic.subs && !topic.subs.includes(sub)) throw Object.assign(new Error('Unknown choice'), { status: 400 });
  // shortcut: device ids can be faked, so the network address is limited too. Add phone OTP if fake swarms appear.
  if (!allowed(`ip:${ip}`, 120, 60 * MIN)) throw Object.assign(new Error('Too many taps from this network. Try in an hour.'), { status: 429 });
  const step = body.topic === 'suraksha' ? 0.005 : 0.001;
  // One phone has one current answer per topic, so tapping again replaces it instead of adding
  db.taps = db.taps.filter((t) => !(t.me === me && t.topic === body.topic));
  db.taps.push({ me, topic: body.topic, sub, bad: Boolean(body.bad), lat: blur(lat, step), lng: blur(lng, step), at: Date.now(), district: at.district, seat: at.seat });
  dirty = true;
  return near({ lat, lng, device: body.device });
}

export function near({ lat, lng, device }) {
  lat = Number(lat); lng = Number(lng);
  const here = { lat, lng };
  const at = place(lat, lng);
  const me = device ? who(device) : null;
  const now = Date.now();
  const out = {};
  for (const [name, t] of Object.entries(TOPICS)) {
    const live = db.taps.filter((x) => x.topic === name && now - x.at < t.ttl && km(x, here) <= (name === 'suraksha' ? 3 : NEAR_KM));
    const bad = live.filter((x) => x.bad);
    out[name] = {
      bad: bad.length,
      ok: live.length - bad.length,
      since: bad.length ? Math.round((now - Math.min(...bad.map((x) => x.at))) / MIN) : null,
      subs: t.subs ? Object.fromEntries(t.subs.map((s) => [s, bad.filter((x) => x.sub === s).length])) : undefined,
      mine: me ? live.find((x) => x.me === me) && { bad: live.find((x) => x.me === me).bad, sub: live.find((x) => x.me === me).sub } : undefined,
    };
  }
  const cases = db.cases.filter((c) => km(c, here) <= CASE_KM)
    .map((c) => ({ ...publicCase(c, me), km: Math.round(km(c, here) * 10) / 10 }))
    .sort((a, b) => (a.fixed - b.fixed) || (b.confirms - a.confirms))
    .slice(0, 20);
  return { place: at, topics: out, cases };
}

function publicCase(c, me) {
  return {
    id: c.id, kind: c.kind, lat: c.lat, lng: c.lng, photo: `/photo/${c.id}.jpg`, at: c.at, days: Math.floor((Date.now() - c.at) / (24 * 60 * MIN)),
    confirms: c.confirms.length, fixed: c.fixedVotes.length >= FIXED_VOTES, fixedVotes: c.fixedVotes.length,
    seatName: c.seatName, district: c.district, mla: c.mla, mine: me ? c.confirms.includes(me) : undefined,
  };
}

export function newCase(body, ip) {
  const { lat, lng, at, me } = check(body);
  if (!KINDS.includes(body.kind)) throw Object.assign(new Error('Unknown kind'), { status: 400 });
  const raw = String(body.photo || '').replace(/^data:image\/jpeg;base64,/, '');
  const img = Buffer.from(raw, 'base64');
  // Only a real JPEG under 600 KB. The phone re-draws it first, which also strips the GPS tags a camera writes in.
  if (img.length < 2000 || img.length > 600000 || img[0] !== 0xff || img[1] !== 0xd8) throw Object.assign(new Error('Photo must be a JPEG under 600 KB'), { status: 400 });
  if (!allowed(`case:${me}`, 5, 24 * 60 * MIN) || !allowed(`caseip:${ip}`, 30, 24 * 60 * MIN)) throw Object.assign(new Error('Too many photos today. Try tomorrow.'), { status: 429 });
  // The same problem photographed twice within 40 m becomes one case with one more confirmation
  const same = db.cases.find((c) => c.kind === body.kind && c.fixedVotes.length < FIXED_VOTES && km(c, { lat, lng }) < 0.04);
  if (same) {
    if (!same.confirms.includes(me)) same.confirms.push(me);
    dirty = true;
    return publicCase(same, me);
  }
  const id = crypto.randomBytes(6).toString('hex');
  fs.writeFileSync(path.join(PHOTOS, `${id}.jpg`), img);
  const c = { id, kind: body.kind, lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5, at: Date.now(), by: me, confirms: [me], fixedVotes: [], flags: [], ...{ seat: at.seat, seatName: at.seatName, district: at.district, mla: at.mla } };
  db.cases.push(c);
  dirty = true;
  return publicCase(c, me);
}

export function vote(id, body, ip) {
  const c = db.cases.find((x) => x.id === id);
  if (!c) throw Object.assign(new Error('No such case'), { status: 404 });
  if (!/^[a-z0-9-]{16,64}$/.test(String(body.device || ''))) throw Object.assign(new Error('Bad device id'), { status: 400 });
  if (!allowed(`vote:${ip}`, 150, 60 * MIN)) throw Object.assign(new Error('Too many votes from this network. Try in an hour.'), { status: 429 });
  // Only people near the problem can confirm it or say it is fixed
  if (body.what !== 'flag') {
    const { lat, lng } = check(body);
    if (km(c, { lat, lng }) > CASE_KM) throw Object.assign(new Error(`You are ${Math.round(km(c, { lat, lng }))} km away. Only people near it can vote.`), { status: 403 });
  }
  const me = who(body.device);
  const list = { confirm: c.confirms, fixed: c.fixedVotes, flag: c.flags }[body.what];
  if (!list) throw Object.assign(new Error('Unknown vote'), { status: 400 });
  if (!list.includes(me)) list.push(me);
  // Three people saying a photo is wrong or private hides it until someone checks
  if (c.flags.length >= 3) { db.cases = db.cases.filter((x) => x !== c); fs.renameSync(path.join(PHOTOS, `${id}.jpg`), path.join(PHOTOS, `${id}.flagged.jpg`)); }
  dirty = true;
  return publicCase(c, me);
}

export const getCase = (id) => { const c = db.cases.find((x) => x.id === id); return c && publicCase(c); };
export const photoPath = (id) => (db.cases.some((c) => c.id === id) ? path.join(PHOTOS, `${id}.jpg`) : null);

// The whole state at a glance: districts with the most people reporting each problem right now
export function state() {
  const now = Date.now();
  const out = {};
  for (const [name, t] of Object.entries(TOPICS)) {
    const by = {};
    db.taps.filter((x) => x.topic === name && x.bad && now - x.at < t.ttl).forEach((x) => { by[x.district] = (by[x.district] || 0) + 1; });
    out[name] = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }
  const open = db.cases.filter((c) => c.fixedVotes.length < FIXED_VOTES);
  const bySeat = {};
  open.forEach((c) => { (bySeat[c.seat] ||= { seat: c.seat, seatName: c.seatName, district: c.district, mla: c.mla, open: 0, people: 0 }); bySeat[c.seat].open += 1; bySeat[c.seat].people += c.confirms.length; });
  return { topics: out, seats: Object.values(bySeat).sort((a, b) => b.people - a.people).slice(0, 10), openCases: open.length };
}

// The week's open cases for one seat, written so it can be pasted to the MLA or the district office
export function digest(seatNo) {
  const s = seats[seatNo];
  if (!s) throw Object.assign(new Error('No such seat'), { status: 404 });
  const open = db.cases.filter((c) => c.seat === s.no && c.fixedVotes.length < FIXED_VOTES).sort((a, b) => b.confirms.length - a.confirms.length);
  return { seat: s.no, seatName: s.name, district: s.district, mla: s.mla?.name, cases: open.map((c) => publicCase(c)) };
}

export async function handle(req, res, url, ip) {
  const send = (code, value) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
  const p = url.pathname;
  const photo = p.match(/^\/photo\/([0-9a-f]{12})\.jpg$/);
  if (photo) {
    const file = photoPath(photo[1]);
    if (!file) { res.writeHead(404); res.end(); return true; }
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' });
    fs.createReadStream(file).pipe(res);
    return true;
  }
  if (!p.startsWith('/api/p/')) return false;
  try {
    if (req.method === 'GET' && p === '/api/p/near') return send(200, near(Object.fromEntries(url.searchParams))), true;
    if (req.method === 'GET' && p === '/api/p/state') return send(200, state()), true;
    const dg = p.match(/^\/api\/p\/digest\/(\d{1,3})$/);
    if (req.method === 'GET' && dg) return send(200, digest(dg[1])), true;
    const one = p.match(/^\/api\/p\/case\/([0-9a-f]{12})$/);
    if (req.method === 'GET' && one) { const c = getCase(one[1]); return send(c ? 200 : 404, c || { error: 'No such case' }), true; }
    if (req.method !== 'POST') return send(405, { error: 'Use POST' }), true;
    const body = await new Promise((done, fail) => {
      let size = 0;
      const parts = [];
      req.on('data', (b) => { size += b.length; if (size > 900000) { fail(Object.assign(new Error('Too big'), { status: 413 })); req.destroy(); } else parts.push(b); });
      req.on('end', () => { try { done(JSON.parse(Buffer.concat(parts).toString() || '{}')); } catch { fail(Object.assign(new Error('Bad JSON'), { status: 400 })); } });
    });
    if (p === '/api/p/tap') return send(200, tap(body, ip)), true;
    if (p === '/api/p/case') return send(200, newCase(body, ip)), true;
    const v = p.match(/^\/api\/p\/case\/([0-9a-f]{12})\/vote$/);
    if (v) return send(200, vote(v[1], body, ip)), true;
    return send(404, { error: 'No such route' }), true;
  } catch (err) {
    send(err.status || 500, { error: err.status ? err.message : 'Something broke on our side' });
    if (!err.status) console.error('pulse:', err);
    return true;
  }
}
