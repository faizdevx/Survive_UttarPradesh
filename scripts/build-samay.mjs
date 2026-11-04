// Saves real photo dates for the Samay slider's preset spots, since reading them live takes minutes.
// Needs the site running on localhost:4173. Run with: node scripts/build-samay.mjs
import fs from 'node:fs';
import { SAMAY_SPOTS } from '../public/js/ghoomo-data.js';

const out = { fetchedAt: new Date().toISOString(), spots: {} };
for (const s of SAMAY_SPOTS) {
  const r = await fetch(`http://localhost:4173/api/samayhere?lat=${s.lat.toFixed(2)}&lng=${s.lng.toFixed(2)}`, { signal: AbortSignal.timeout(400000) });
  if (!r.ok) { console.log(s.name, 'failed', r.status); continue; }
  const j = await r.json();
  out.spots[s.name] = j;
  console.log(s.name, j.dated, j.stops.length, j.stops.map((x) => x.photo).join(' '));
}
fs.writeFileSync('public/data/samay-spots.json', JSON.stringify(out));
console.log('saved', Object.keys(out.spots).length, 'bytes', JSON.stringify(out).length);
