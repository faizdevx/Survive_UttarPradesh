// Shared by the Kohra meter page, the home button and the city page.
export const LEVELS = {
  kohra: [
    { color: '#cfe3d4', label: 'Low risk', road: 'Low risk, not a promise. Fog forms in patches.', rail: 'Low fog risk along this line.' },
    { color: '#ffe08a', label: 'Mist possible', road: 'Watch for patches, and keep your speed down.', rail: 'Small delays possible.' },
    { color: '#ff9d3b', label: 'Fog likely', road: 'Leave after sunrise if you can.', rail: 'Delays look likely. Check before leaving home.' },
    { color: '#c21f1f', label: 'Dense fog risk', road: 'Avoid before 9 AM if you can.', rail: 'Long delays are possible. Check before leaving home.' },
  ],
  loo: [
    { color: '#cfe3d4', label: 'Under 37°C' },
    { color: '#ffe08a', label: '37 to 40°C, hot' },
    { color: '#ff9d3b', label: '40 to 45°C, loo' },
    { color: '#c21f1f', label: '45°C and up, severe' },
  ],
};

// Routes run through each district's main town, so the drawn lines are rough.
export const ROADS = [
  { name: 'Yamuna Expressway', districts: ['Gautam Buddha Nagar', 'Mathura', 'Agra'] },
  { name: 'Agra-Lucknow Expressway', districts: ['Agra', 'Firozabad', 'Mainpuri', 'Etawah', 'Kannauj', 'Hardoi', 'Unnao', 'Lucknow'] },
  { name: 'Purvanchal Expressway', districts: ['Lucknow', 'Barabanki', 'Amethi', 'Sultanpur', 'Ayodhya', 'Ambedkar Nagar', 'Azamgarh', 'Mau', 'Ghazipur'] },
  { name: 'Bundelkhand Expressway', districts: ['Chitrakoot', 'Banda', 'Hamirpur', 'Jalaun', 'Auraiya', 'Etawah'] },
  { name: 'Gorakhpur Link Expressway', districts: ['Gorakhpur', 'Sant Kabir Nagar', 'Ambedkar Nagar', 'Azamgarh'] },
  { name: 'Delhi-Meerut Expressway', districts: ['Ghaziabad', 'Meerut'] },
  { name: 'GT Road, NH-19', districts: ['Mathura', 'Agra', 'Firozabad', 'Etawah', 'Kanpur Nagar', 'Fatehpur', 'Prayagraj', 'Varanasi'] },
];
export const RAILS = [
  { name: 'Delhi to Varanasi', districts: ['Ghaziabad', 'Bulandshahr', 'Aligarh', 'Hathras', 'Firozabad', 'Etawah', 'Kanpur Nagar', 'Fatehpur', 'Prayagraj', 'Chandauli', 'Varanasi'] },
  { name: 'Delhi to Lucknow via Moradabad', districts: ['Ghaziabad', 'Hapur', 'Amroha', 'Moradabad', 'Rampur', 'Bareilly', 'Shahjahanpur', 'Hardoi', 'Lucknow'] },
  { name: 'Delhi to Agra', districts: ['Mathura', 'Agra'] },
  { name: 'Kanpur to Lucknow', districts: ['Kanpur Nagar', 'Unnao', 'Lucknow'] },
  { name: 'Lucknow to Gorakhpur', districts: ['Lucknow', 'Barabanki', 'Gonda', 'Basti', 'Sant Kabir Nagar', 'Gorakhpur'] },
  { name: 'Lucknow to Varanasi', districts: ['Lucknow', 'Rae Bareli', 'Pratapgarh', 'Jaunpur', 'Varanasi'] },
];

export const seasonNow = () => { const m = new Date().getMonth() + 1; return m >= 10 || m <= 3 ? 'kohra' : 'loo'; };
const hourOf = (iso) => Number(iso.slice(11, 13));
const dayOf = (iso) => iso.slice(0, 10);

let pending = null;
export function loadKohra() {
  if (!pending) {
    pending = fetch('/api/kohra').then(async (r) => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      return j;
    }).catch((err) => { pending = null; throw err; });
  }
  return pending;
}

// The fog hours of the next morning still to come, 3 to 9 AM
export function nextMorning(data) {
  const first = data.hours.findIndex((t) => { const h = hourOf(t); return h >= 3 && h <= 9; });
  const day = dayOf(data.hours[first]);
  const idx = data.hours.map((t, i) => (dayOf(t) === day && hourOf(t) >= 3 && hourOf(t) <= 9 ? i : -1)).filter((i) => i >= 0);
  const today = dayOf(data.hours[0]) === day;
  const hour = data.hours[0] ? hourOf(data.hours[0]) : 0;
  return { idx, word: today && hour < 10 ? 'Aaj subah' : 'Kal subah' };
}
// The rest of today, or tomorrow once the afternoon has passed
export function nextPeak(data) {
  const late = hourOf(data.hours[0]) >= 17;
  const day = late ? dayOf(data.hours[24]) : dayOf(data.hours[0]);
  return { idx: data.hours.map((t, i) => (dayOf(t) === day ? i : -1)).filter((i) => i >= 0), word: late ? 'Kal' : 'Aaj' };
}
export const worstFog = (data, name, idx) => Math.max(...idx.map((i) => Number(data.d[name].f[i])));
export const peakTemp = (data, name, idx) => Math.max(...idx.map((i) => data.d[name].t[i]));
export const looLevel = (t) => (t >= 45 ? 3 : t >= 40 ? 2 : t >= 37 ? 1 : 0);

export function headline(data, season = seasonNow()) {
  const names = Object.keys(data.d);
  if (season === 'kohra') {
    const { idx, word } = nextMorning(data);
    const risky = names.filter((n) => worstFog(data, n, idx) >= 2).length;
    return risky ? `${word}: fog risk in ${risky} of ${names.length} districts` : `${word}: no district at high fog risk`;
  }
  const { idx, word } = nextPeak(data);
  const hot = names.filter((n) => peakTemp(data, n, idx) >= 40).length;
  return hot ? `${word}: loo in ${hot} of ${names.length} districts` : `${word}: no district past 40°C`;
}

export function cityLine(data, name, season = seasonNow()) {
  if (!data.d[name]) return null;
  if (season === 'kohra') {
    const { idx, word } = nextMorning(data);
    return { label: `${word} kohra`, value: LEVELS.kohra[worstFog(data, name, idx)].label };
  }
  const { idx, word } = nextPeak(data);
  const t = peakTemp(data, name, idx);
  return { label: `${word} ki garmi`, value: `${Math.round(t)}°C`, small: LEVELS.loo[looLevel(t)].label };
}
