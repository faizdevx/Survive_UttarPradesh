// Builds Ghoomo's checked data: odd place names and exact craft pins from GeoNames (CC BY 4.0),
// plus a Wikipedia source check for each hand-written entry. Run with: node scripts/build-ghoomo.mjs
import fs from 'node:fs';
import zlib from 'node:zlib';
import { TRAIN_ROUTES, SEASON_FOOD, SMELLS, KARIGAR } from '../public/js/ghoomo-data.js';

const UA = { 'User-Agent': 'SurviveUP/0.1 (github.com/faizdevx/Survive_UttarPradesh)' };

function unzipFirst(buf, wanted) {
  let end = buf.length - 22;
  while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) end -= 1;
  let at = buf.readUInt32LE(end + 16);
  for (let i = 0; i < buf.readUInt16LE(end + 10); i += 1) {
    const size = buf.readUInt32LE(at + 20);
    const nameLen = buf.readUInt16LE(at + 28);
    const extra = buf.readUInt16LE(at + 30);
    const note = buf.readUInt16LE(at + 32);
    const start = buf.readUInt32LE(at + 42);
    if (buf.toString('latin1', at + 46, at + 46 + nameLen) === wanted) {
      const data = start + 30 + buf.readUInt16LE(start + 26) + buf.readUInt16LE(start + 28);
      return zlib.inflateRawSync(buf.subarray(data, data + size)).toString('utf8');
    }
    at += 46 + nameLen + extra + note;
  }
  throw new Error(`${wanted} not in zip`);
}

console.log('Downloading GeoNames India…');
const zip = Buffer.from(await (await fetch('https://download.geonames.org/export/dump/IN.zip', { headers: UA, signal: AbortSignal.timeout(180000) })).arrayBuffer());
const places = unzipFirst(zip, 'IN.txt').split('\n').map((l) => l.split('\t')).filter((c) => c[10] === '36' && c[6] === 'P')
  .map((c) => ({ name: c[1], ascii: c[2], lat: +c[4], lng: +c[5], pop: +c[14] || 0, code: c[7] }));
console.log('UP populated places', places.length);
const byName = {};
places.forEach((p) => { (byName[p.ascii.toLowerCase()] ||= []).push(p); });

// Meanings are written first, and a name only appears if it exists in UP. Slurs and caste names are left out.
const ODD = {
  Bhainsa: 'Literally means buffalo.', Bhainsi: 'A female buffalo. Respect.', Bakri: 'Means goat.', Hathi: 'Means elephant.', Ghora: 'Means horse.', Sher: 'Means lion. Bold.', Billi: 'Means cat.', Murgi: 'Means hen.', Mor: 'Means peacock, the national bird.', Tota: 'Means parrot.', Kabutar: 'Means pigeon.', Machhli: 'Means fish.', Kachhua: 'Means turtle. Take it slow.', Titar: 'A partridge.',
  Aam: 'Means mango. Good choice.', Kela: 'Means banana.', Imli: 'Means tamarind.', Nimbu: 'Means lemon.', Mooli: 'Means radish.', Lauki: 'Means bottle gourd. Nobody asked for this.', Aloo: 'Means potato.', Pyaz: 'Means onion.', Lahsun: 'Means garlic.', Gobhi: 'Means cauliflower.', Mirchi: 'Means chilli.', Haldi: 'Means turmeric.', Dhaniya: 'Means coriander, the free one at the sabzi stall.', Namak: 'Means salt.', Gur: 'Means jaggery.', Ghee: 'Exactly what it sounds like.', Dahi: 'Means curd.', Doodh: 'Means milk.', Makhan: 'Means butter.', Lassi: 'Yes, like the drink.', Chai: 'A place called tea.', Roti: 'Means bread.', Puri: 'Fried bread.', Kachori: 'Breakfast of Uttar Pradesh.', Samosa: 'A real place, apparently.', Jalebi: 'As twisty as the name.', Laddu: 'Means sweet ball.', Khichdi: 'A place named after comfort food.', Paan: 'Means betel leaf.', Tamatar: 'Means tomato.', Ganna: 'Means sugarcane.',
  Pyar: 'Means love.', Ishq: 'Means love, the serious kind.', Khushi: 'Means happiness.', Sukh: 'Means comfort.', Dukh: 'Means sorrow. Hopefully just the name.', Sundar: 'Means beautiful.', Mast: 'Means carefree.', Anand: 'Means joy.', Sasur: 'Means father-in-law.', Saas: 'Means mother-in-law. Behave yourself.', Bahu: 'Means daughter-in-law.', Mama: "Means mother's brother.", Nana: "Means mother's father.", Dada: "Means father's father.", Bhaiya: 'Means big brother.', Chacha: "Means father's brother.",
  Bijli: 'Means electricity. Check if it has any.', Pani: 'Means water.', Hawa: 'Means air.', Aag: 'Means fire.', Aasman: 'Means sky.', Chand: 'Means moon.', Suraj: 'Means sun.', Tara: 'Means star.', Raja: 'Means king.', Rani: 'Means queen.', Daroga: 'Means police inspector. Drive carefully.', Vakil: 'Means lawyer.', Master: 'Means teacher.', Kaptan: 'Means captain.', Jail: 'Yes. Jail.', Thana: 'Means police station.', Kachahri: 'Means courthouse.', Bazar: 'Means market.', Naya: 'Means new.', Purana: 'Means old.', Bada: 'Means big.', Chhota: 'Means small.', Lamba: 'Means long.', Mota: 'Means fat.', Dubla: 'Means thin.', London: 'Not that one.', Paris: 'Not that one either.', China: 'Also not that one.', America: 'Long way from the other one.', Dubai: 'No towers here.', Delhi: 'A small Delhi inside UP.',
  Machhlishahr: 'Fish City. An actual town with an actual MLA.', Dildarnagar: 'Town of the big-hearted. Bold claim.', 'Bakshi Ka Talab': "Bakshi's Pond. A whole assembly seat is named after this pond.", 'Thana Bhawan': 'Sounds like a police station building. It is a town.', Colonelganj: "The Colonel's market.", Kaptanganj: "The Captain's market. The Colonel has competition.", Campierganj: 'An English-sounding name in deep Gorakhpur.', Rath: 'Means chariot. Parking is your problem.', Bah: 'Bah. That is the entire name.', Duddhi: 'Sounds like milk. Near the far southern tip of UP.', Chakia: 'Sounds like chakki, the grinding stone.', 'Chauri Chaura': 'A rhyme so good that history textbooks kept it.', Rupaidiha: 'Rupai is right there in the name. Also a Nepal border crossing.', Sonauli: 'Keep walking and you are in Nepal.', Paniyara: 'Pani in the name, and no promise about the supply.',
};
const ajeeb = [];
const missing = [];
Object.entries(ODD).forEach(([name, note]) => {
  const hits = byName[name.toLowerCase()];
  if (!hits) { missing.push(name); return; }
  const p = [...hits].sort((a, b) => b.pop - a.pop)[0];
  ajeeb.push({ name, note, lat: p.lat, lng: p.lng, area: '', copies: hits.length });
});
fs.writeFileSync('public/data/ajeeb.json', JSON.stringify(ajeeb));

// Exact pins where a named place exists. The rest stay marked as areas.
const known = JSON.parse(fs.readFileSync('public/data/districts.json'));
const km = (a, b) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 111 * Math.cos(a.lat * Math.PI / 180));
const PLACE_NAMES = { 'Tulsi Ghat': 'Tulsi Ghat', Ramnagar: 'Ramnagar', Madanpura: 'Madanpura', 'Gai Ghat side': 'Gai Ghat', Chowk: 'Chowk', Nizamabad: 'Nizamabad', 'Aurangabad village side': 'Aurangabad', Khurja: 'Khurja', 'Vrindavan side': 'Vrindavan' };
const pins = {};
for (const k of KARIGAR) {
  const wanted = PLACE_NAMES[k.place];
  const centre = known[k.district];
  if (!wanted) continue;
  let hit = (byName[wanted.toLowerCase()] || []).filter((p) => km(p, centre) < 45).sort((a, b) => km(a, centre) - km(b, centre))[0];
  if (!hit) {
    const r = await fetch(`https://photon.komoot.io/api/?lat=${centre.lat}&lon=${centre.lng}&limit=5&location_bias_scale=0.1&q=${encodeURIComponent(wanted)}`, { headers: UA, signal: AbortSignal.timeout(30000) }).then((x) => x.json()).catch(() => null);
    const f = r?.features?.find((x) => x.properties.name?.toLowerCase() === wanted.toLowerCase());
    if (f) {
      const p = { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
      if (km(p, centre) < 45) hit = p;
    }
    await new Promise((x) => setTimeout(x, 1200));
  }
  if (hit) pins[k.what] = { lat: +hit.lat.toFixed(4), lng: +hit.lng.toFixed(4), place: wanted };
}

// Each entry names the article it should be backed by. It counts only if that article exists and its text
// names the place. Open search matched nonsense, such as a dish matching a poet from the same town.
const ARTICLES = {
  'food:Makhan malai': ['Makhan malai', 'Lucknow'], 'food:Malaiyo': ['Makhan malai', 'Varanasi'], 'food:Surkha guava': ['Allahabadi Surkha', 'Allahabad'], 'food:Fresh gur': ['Muzaffarnagar jaggery', 'Muzaffarnagar'], 'food:Gajak and revdi': ['Gajak', 'Meerut'], 'food:Fresh amla': ['Phyllanthus emblica', 'Pratapgarh'], 'food:Gujiya and thandai': ['Gujiya', 'Holi'], 'food:Aam panna': ['Aam panna', 'mango'], 'food:Dasheri mango': ['Dasheri', 'Malihabad'], 'food:Langra mango': ['Langra (mango)', 'Varanasi'], 'food:Chausa mango': ['Chaunsa (mango)', 'Hardoi'], 'food:Ghevar': ['Ghevar', 'Sawan'],
  'smell:Attar': ['Kannauj', 'attar'], 'smell:Hing': ['Hathras', 'asafoetida'], 'smell:Rose water': ['Ghazipur', 'rose'], 'smell:Tanneries': ['Jajmau', 'tanner'], 'smell:Boiling gur': ['Muzaffarnagar jaggery', 'jaggery'], 'smell:Hot glass': ['Firozabad', 'glass'], 'smell:Kebab smoke': ['Awadhi cuisine', 'kebab'], 'smell:Marigold and incense': ['Ghats in Varanasi', 'Ganga'], 'smell:Brass polish': ['Moradabad', 'brass'], 'smell:Wet wool': ['Bhadohi', 'carpet'], 'smell:Mango blossom': ['Malihabad', 'mango'], 'smell:Fresh clay': ['Khurja', 'ceramic'],
  'karigar:Kushti akhada': ['Tulsi Ghat', 'Varanasi'], 'karigar:Ramnagar Ramlila': ['Ramlila', 'Ramnagar'], 'karigar:Banarasi handloom': ['Banarasi sari', 'Varanasi'], 'karigar:Gulabi meenakari': ['Meenakari', 'Varanasi'], 'karigar:Kabootarbaazi': ['Pigeon keeping', 'pigeon'], 'karigar:Patang makers': ['Lucknow', 'kite'], 'karigar:Chikankari': ['Chikan (embroidery)', 'Lucknow'], 'karigar:Dastangoi': ['Dastangoi', 'Lucknow'], 'karigar:Bansuri makers': ['Pilibhit', 'flute'], 'karigar:Black pottery': ['Nizamabad, Azamgarh', 'pottery'], 'karigar:Attar distilling': ['Kannauj', 'attar'], 'karigar:Terracotta': ['Gorakhpur terracotta', 'Gorakhpur'], 'karigar:Khurja pottery': ['Khurja', 'pottery'], 'karigar:Hathrasi nautanki': ['Nautanki', 'Hathras'], 'karigar:Sanjhi paper cutting': ['Sanjhi', 'Mathura'],
  'train:Agra:Petha, dalmoth, bedai': ['Petha', 'Agra'], 'train:Mathura:Mathura peda': ['Peda', 'Mathura'], 'train:Kanpur:Thaggu ke laddu': ['Thaggu ke Laddu', 'Kanpur'], 'train:Sandila:Sandila laddu': ['Sandila', 'laddu'], 'train:Hapur:Papad': ['Hapur', 'papad'], 'train:Jaunpur:Imarti': ['Jaunpur, Uttar Pradesh', 'imarti'], 'train:Khurja:Khurchan': ['Khurja', 'khurchan'], 'train:Moradabad:Moradabadi dal': ['Moradabad', 'dal'], 'train:Pratapgarh:Amla murabba and candy': ['Pratapgarh, Uttar Pradesh', 'amla'], 'train:Lucknow:Kebab, kulcha nihari, makhan malai in winter': ['Awadhi cuisine', 'Lucknow'],
};
const article = async (title) => {
  for (let tries = 0; tries < 3; tries += 1) {
    await new Promise((x) => setTimeout(x, 900 + tries * 4000));
    try {
      const r = await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=extracts&explaintext=1&titles=${encodeURIComponent(title)}`, { headers: UA, signal: AbortSignal.timeout(30000) });
      if (!r.ok) continue;
      const page = Object.values((await r.json()).query.pages)[0];
      return page.missing !== undefined ? { missing: true } : { title: page.title, id: page.pageid, text: page.extract || '' };
    } catch { /* tries again */ }
  }
  return { failed: true };
};
const sources = {};
const failed = [];
const pages = {};
for (const [key, [title, word]] of Object.entries(ARTICLES)) {
  pages[title] ||= await article(title);
  const p = pages[title];
  if (p.failed) failed.push(key);
  sources[key] = p.text && p.text.toLowerCase().includes(word.toLowerCase()) ? { title: p.title, url: `https://en.wikipedia.org/?curid=${p.id}` } : null;
}
fs.writeFileSync('public/data/ghoomo-checks.json', JSON.stringify({ checkedOn: new Date().toISOString().slice(0, 10), pins, sources, geonames: 'https://www.geonames.org/', placesInUp: places.length }));

const vals = Object.entries(sources);
console.log({ ajeeb: ajeeb.length, ajeebMissing: missing.length, sample: ajeeb.slice(0, 30).map((a) => a.name).join(', ') });
console.log({ pins: Object.keys(pins), noPin: KARIGAR.filter((k) => !pins[k.what]).map((k) => k.what) });
console.log({ sourced: vals.filter(([, v]) => v).length, of: vals.length, none: vals.filter(([, v]) => !v).map(([k]) => k).join(' | ') });
console.log(vals.filter(([, v]) => v).map(([k, v]) => `${k} -> ${v.title}`).join('\n'));
console.log({ failed });
