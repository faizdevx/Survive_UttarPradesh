// Builds public/data/ajeeb.json. A name is only listed if OpenStreetMap finds that exact place in UP.
// Run with: node scripts/build-ajeeb.mjs
import fs from 'node:fs';

const UA = { 'User-Agent': 'SurviveUP/0.1 (github.com/faizdevx/Survive_UttarPradesh)' };
const NAMES = [
  ['Bhainsa', 'Literally means buffalo.'],
  ['Machhlishahr', 'Fish City. An actual town with an actual MLA.'],
  ['Dildarnagar', 'Town of the big-hearted. Bold claim.'],
  ['Bakshi Ka Talab', "Bakshi's Pond. A whole assembly seat is named after this pond."],
  ['Thana Bhawan', 'Sounds like a police station building. It is a town.'],
  ['Colonelganj', "The Colonel's market. Nobody knows which colonel without looking it up."],
  ['Kaptanganj', "The Captain's market. The Colonel has competition."],
  ['Campierganj', 'An English-sounding name in deep Gorakhpur.'],
  ['Rath', 'Means chariot. Parking is your problem.'],
  ['Bah', 'Bah. That is the entire name.'],
  ['Duddhi', 'Sounds like milk. Sits near the far southern tip of UP.'],
  ['Chakia', 'Sounds like chakki, the grinding stone.'],
  ['Chauri Chaura', 'A rhyme so good that history textbooks kept it.'],
  ['Rupaidiha', 'Rupai is right there in the name. It is also a Nepal border crossing.'],
  ['Sonauli', 'Keep walking and you are in Nepal.'],
  ['Chillupar', 'Sounds made up. It is a Gorakhpur assembly seat.'],
  ['Paniyara', 'Pani in the name, and no promise about the supply.'],
];

const out = [];
const dropped = [];
for (const [name, note] of NAMES) {
  const url = `https://photon.komoot.io/api/?limit=8&bbox=77,23.8,84.7,30.5&q=${encodeURIComponent(name)}`;
  const { features } = await (await fetch(url, { headers: UA })).json();
  const hit = features.find((f) => f.properties.name?.toLowerCase() === name.toLowerCase() && /uttar pradesh/i.test(f.properties.state || ''));
  if (hit) {
    const [lng, lat] = hit.geometry.coordinates;
    out.push({ name, note, lat: +lat.toFixed(4), lng: +lng.toFixed(4), area: hit.properties.county || hit.properties.district || hit.properties.city || '' });
  } else dropped.push(name);
  await new Promise((r) => setTimeout(r, 1200));
}
fs.writeFileSync('public/data/ajeeb.json', JSON.stringify(out));
console.log({ kept: out.length, dropped });
