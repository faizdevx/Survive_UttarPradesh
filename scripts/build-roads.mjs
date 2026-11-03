// Builds public/data/roads.json: real expressway shapes from OpenStreetMap, and the districts they truly cross.
// Overpass is often busy, so a road it cannot return simply keeps its rough fallback in the app.
// Run with: node scripts/build-roads.mjs
import fs from 'node:fs';

const ROADS = { 'Yamuna Expressway': 'Yamuna Expressway', 'Agra-Lucknow Expressway': 'Agra.*Lucknow|Lucknow.*Agra', 'Purvanchal Expressway': 'Purvanchal', 'Bundelkhand Expressway': 'Bundelkhand', 'Gorakhpur Link Expressway': 'Gorakhpur Link', 'Delhi-Meerut Expressway': 'Delhi.*Meerut' };
const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const geo = JSON.parse(fs.readFileSync('public/data/up.geojson'));
const inRing = (lng, lat, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const districtAt = (lat, lng) => geo.features.find(({ geometry: g }) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).some((p) => inRing(lng, lat, p[0])))?.properties.district;
const km = (a, b) => Math.hypot((a[0] - b[0]) * 111, (a[1] - b[1]) * 111 * Math.cos(a[0] * Math.PI / 180));

async function ask(pattern) {
  const data = `[out:json][timeout:90];way["highway"~"^(motorway|trunk)$"]["name"~"${pattern}",i](23.8,77,30.5,84.7);out geom;`;
  for (const url of SERVERS) {
    try {
      const r = await fetch(url, { method: 'POST', body: new URLSearchParams({ data }), headers: { 'User-Agent': 'SurviveUP/0.1 (github.com/faizdevx/Survive_UttarPradesh)' }, signal: AbortSignal.timeout(100000) });
      if (r.ok) {
        const j = JSON.parse(await r.text());
        if (j.elements.length) return j.elements;
      }
    } catch { /* next server */ }
  }
  return null;
}

const out = { fetchedAt: new Date().toISOString(), source: 'https://www.openstreetmap.org/copyright', roads: {} };
for (const [name, pattern] of Object.entries(ROADS)) {
  const ways = await ask(pattern);
  if (!ways) { console.log(name, 'no answer'); continue; }
  const byDistrict = {};
  const lines = ways.map((w) => {
    const pts = w.geometry.map((p) => [p.lat, p.lon]);
    for (let i = 1; i < pts.length; i += 1) {
      const d = districtAt(...pts[i]);
      if (d) byDistrict[d] = (byDistrict[d] || 0) + km(pts[i - 1], pts[i]);
    }
    // Every few points is plenty for a line on this map
    return pts.filter((_, i) => i % 6 === 0 || i === pts.length - 1).map((p) => [+p[0].toFixed(4), +p[1].toFixed(4)]);
  });
  // Both carriageways are mapped apart, so lengths count as half
  const districts = Object.fromEntries(Object.entries(byDistrict).filter(([, v]) => v > 1).map(([k, v]) => [k, Math.round(v / 2)]));
  out.roads[name] = { lines, districts, km: Object.values(districts).reduce((a, b) => a + b, 0) };
  console.log(name, 'ways', ways.length, 'km', out.roads[name].km, Object.keys(districts).join(', '));
  await new Promise((r) => setTimeout(r, 4000));
}
if (Object.keys(out.roads).length) fs.writeFileSync('public/data/roads.json', JSON.stringify(out));
console.log('roads kept', Object.keys(out.roads).length, 'bytes', JSON.stringify(out).length);
