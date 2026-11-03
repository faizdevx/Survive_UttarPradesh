import { ELECTION, PARTIES, NETA_PARTY, HELPLINES, LAW_CATS, AREA_CATS, UNDER_TABS, SUBS, SEARCH_NAME, OLD_NAMES, CRAFT, ODOP, MUSIC, HISTORY, BLOCS, RTO, PROJECTS, MONEY_LINKS, PAPERS } from './content.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https?:\/\//.test(u || '') ? esc(u) : '#');
const api = async (route, params) => {
  const r = await fetch(`/api/${route}?${new URLSearchParams(params)}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error);
  return data;
};
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private window */ } },
};
const dirLink = (p) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
const timeAgo = (d) => {
  const t = new Date(d);
  return Number.isNaN(+t) ? '' : t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const state = { age: Number(store.get('age')) || null, mode: 'party', districts: {}, netas: {}, current: null, origin: null, geo: null };

/* TV intro */
function intro() {
  const tv = $('#tv');
  const canvas = $('#static');
  const tick = () => { $('#clock').textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }); };
  tick();
  const clock = setInterval(tick, 30000);

  const burst = (ms) => new Promise((done) => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return done();
    const ctx = canvas.getContext('2d');
    canvas.width = 220; canvas.height = 170;
    canvas.classList.add('on');
    const timer = setInterval(() => {
      const img = ctx.createImageData(canvas.width, canvas.height);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }, 40);
    setTimeout(() => { clearInterval(timer); canvas.classList.remove('on'); done(); }, ms);
  });

  const shutDown = async () => {
    tv.classList.add('off');
    clearInterval(clock);
    setTimeout(() => { tv.remove(); state.map.invalidateSize(); }, 900);
  };

  $('#powerBtn').addEventListener('click', async () => {
    await burst(450);
    if (state.age) return shutDown();
    $('#tvTitle').hidden = true;
    $('#tvAge').hidden = false;
    $('#powerBtn').textContent = 'Back on';
    $('#ageInput').focus();
  });
  $('#tvAge').addEventListener('submit', async (e) => {
    e.preventDefault();
    state.age = Number($('#ageInput').value);
    store.set('age', state.age);
    await burst(300);
    shutDown();
  });
}

/* Map */
const SHARE_BINS = [
  { max: 10, color: '#fff2ae', label: 'Under 10%' }, { max: 20, color: '#f9c97c', label: '10 to 20%' },
  { max: 30, color: '#e8866a', label: '20 to 30%' }, { max: 40, color: '#a9498f', label: '30 to 40%' },
  { max: 101, color: '#4b1a7f', label: '40% and up' },
];

const partyKey = (p) => NETA_PARTY[p] || p;
function mlaCounts(name) {
  const counts = {};
  (state.netas[name] || []).forEach((m) => { const k = partyKey(m.party); counts[k] = (counts[k] || 0) + 1; });
  return Object.entries(counts).sort((x, y) => y[1] - x[1]);
}

function style(feature) {
  const d = state.districts[feature.properties.district];
  let fill = '#777';
  let dash = null;
  if (state.mode === 'party') {
    fill = PARTIES[d.seats[0]?.party]?.color || '#777';
    if (new Set(d.seats.map((s) => s.party)).size > 1) dash = '6 5';
  } else if (state.mode === 'mla') {
    const counts = mlaCounts(d.name);
    fill = PARTIES[counts[0]?.[0]]?.color || '#777';
    if (counts.length > 1) dash = '6 5';
  } else if (d.census) {
    fill = SHARE_BINS.find((b) => d.census.share < b.max).color;
  }
  const on = state.current === d.name;
  // Fade the colour once zoomed in so the satellite view stays readable
  const close = state.map.getZoom() >= 10;
  return { fillColor: fill, fillOpacity: close ? 0.08 : on ? 0.72 : 0.5, color: on ? '#f6c400' : '#000', weight: on ? 4 : 1.2, dashArray: dash };
}

function tipFor(name) {
  const d = state.districts[name];
  if (state.mode === 'party') {
    return `<b>${esc(name)}</b>${d.seats.map((s) => `${esc(s.seat)}: ${esc(PARTIES[s.party]?.name || s.party)}`).join('<br>')}`;
  }
  if (state.mode === 'mla') {
    return `<b>${esc(name)}</b>${mlaCounts(name).map(([p, n]) => `${esc(PARTIES[p]?.name || p)}: ${n}`).join('<br>')}`;
  }
  const share = d.census ? `Muslim ${d.census.share}%, mostly Hindu otherwise` : 'No separate 2011 figure';
  return `<b>${esc(name)}</b>${share}${BLOCS[name] ? `<br>Press-named blocs: ${esc(BLOCS[name])}` : ''}`;
}

function renderLegend() {
  const named = (keys) => keys.map((k) => [PARTIES[k].color, PARTIES[k].name]);
  const items = state.mode === 'party'
    ? named(['BJP', 'SP', 'INC', 'RLD', 'ADS', 'ASP'])
    : state.mode === 'mla' ? named(['BJP', 'SP', 'ADS', 'RLD', 'SBSP', 'NISHAD', 'INC', 'JDL', 'BSP']) : [...SHARE_BINS.map((b) => [b.color, b.label]), ['#777', 'No separate figure']];
  $('#legend').innerHTML = items.map(([c, l]) => `<div><i style="background:${c}"></i>${esc(l)}</div>`).join('');
  $('#legendNote').textContent = state.mode === 'party'
    ? 'Winner of the 2024 Lok Sabha seat for each district. Dashed outline: seats in this district went to different parties.'
    : state.mode === 'mla' ? 'Party with the most MLAs in each district, from the 2022 election and later bye-elections. Dashed outline: the district is split.'
    : 'Muslim share from Census 2011, district level. India has published no caste count since 1931, so caste blocs are what the press names, shown on hover.';
}

async function initMap() {
  const map = L.map('map', { zoomControl: true, minZoom: 6, maxBounds: [[22, 74], [32, 88]] }).setView([27.0, 80.6], 7);
  state.map = map;
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Imagery Esri, Maxar. Places OpenStreetMap, Wikidata', maxZoom: 19 }).addTo(map);
  map.createPane('labels');
  map.getPane('labels').style.zIndex = 640;
  map.getPane('labels').style.pointerEvents = 'none';
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { pane: 'labels', maxZoom: 19 }).addTo(map);
  state.pins = L.layerGroup().addTo(map);

  state.newsPins = L.layerGroup().addTo(map);
  state.statePins = L.layerGroup().addTo(map);
  const [districts, geo, netas] = await Promise.all(['data/districts.json', 'data/up.geojson', 'data/netas.json'].map((u) => fetch(u).then((r) => r.json())));
  state.districts = districts;
  state.netas = netas;
  state.geo = geo;
  state.layer = L.geoJSON(geo, {
    style,
    onEachFeature(f, layer) {
      const name = f.properties.district;
      layer.bindTooltip(() => tipFor(name), { sticky: true, className: 'dist-tip' });
      layer.on('click', () => openCity(name));
    },
  }).addTo(map);
  map.fitBounds(state.layer.getBounds(), { paddingTopLeft: [260, 10] });

  map.on('zoomend', () => state.layer.setStyle(style));
  $('#districtPick').insertAdjacentHTML('beforeend', Object.keys(districts).sort().map((n) => `<option>${esc(n)}</option>`).join(''));
  $('#districtPick').addEventListener('change', (e) => { if (e.target.value) openCity(e.target.value); });
  renderLegend();

  document.querySelectorAll('.switch button').forEach((b) => b.addEventListener('click', () => {
    state.mode = b.dataset.mode;
    document.querySelectorAll('.switch button').forEach((x) => x.setAttribute('aria-checked', x === b));
    state.layer.setStyle(style);
    renderLegend();
  }));
  $('#nearMe').addEventListener('click', nearMe);
  $('#todayNews').addEventListener('change', showStatePins);
  loadStateNews();
}

/* Today's news across the state */
const namePattern = (n) => new RegExp(`\\b${(SEARCH_NAME[n] || n).replace(/[^\w ]/g, '')}\\b`, 'i');
function showStatePins() {
  const on = $('#todayNews').checked && !state.current;
  if (on) state.statePins.addTo(state.map); else state.statePins.remove();
}
async function loadStateNews() {
  const msg = $('#todayMsg');
  try {
    const items = await api('news', { q: 'Uttar Pradesh when:1d' });
    const names = Object.keys(state.districts).map((n) => [n, namePattern(n)]);
    const seen = {};
    let count = 0;
    items.forEach((n) => {
      const hit = names.find(([, re]) => re.test(n.title))?.[0];
      if (!hit) return;
      const d = state.districts[hit];
      // Several stories in one district fan out around its centre
      const i = (seen[hit] = (seen[hit] || 0) + 1) - 1;
      const pos = [d.lat + 0.07 * i * Math.sin(i * 2.4), d.lng + 0.07 * i * Math.cos(i * 2.4)];
      L.marker(pos, { icon: pinIcon('news') }).addTo(state.statePins)
        .bindPopup(`<b>${esc(hit)}</b><br><a href="${safeUrl(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a><br><button class="link-open" data-city="${esc(hit)}">Open ${esc(hit)}</button>`);
      count += 1;
    });
    state.map.on('popupopen', (e) => {
      e.popup.getElement()?.querySelector('[data-city]')?.addEventListener('click', (ev) => openCity(ev.target.dataset.city));
    });
    msg.textContent = `${count} stories from the last day, pinned to the district named in the headline.`;
  } catch (err) { msg.textContent = `Could not load today's news: ${err.message}`; }
}

function inRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function districtAt(lat, lng) {
  const f = state.geo.features.find(({ geometry: g }) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).some((poly) => inRing(lng, lat, poly[0])));
  return f?.properties.district;
}

function nearMe() {
  const msg = $('#findMsg');
  if (!navigator.geolocation) { msg.textContent = 'This browser has no location. Pick a district instead.'; return; }
  msg.textContent = 'Finding you…';
  navigator.geolocation.getCurrentPosition((pos) => {
    const { latitude: lat, longitude: lng } = pos.coords;
    const name = districtAt(lat, lng);
    if (!name) { msg.textContent = 'You are outside Uttar Pradesh. Pick a district instead.'; return; }
    msg.textContent = '';
    openCity(name, { lat, lng });
    api('locality', { lat, lng }).then((p) => { if (p.name && state.current === name) { const el = $('#hereNow'); if (el) { el.hidden = false; $('dd', el).textContent = p.name; } } }).catch(() => {});
  }, () => { msg.textContent = 'Location was blocked. Pick a district instead.'; }, { timeout: 10000 });
}

/* Places */
const ageBand = () => (state.age < 18 ? 'teen' : state.age < 31 ? 'young' : state.age < 50 ? 'mid' : 'senior');
const AGE_WORDS = { teen: 'students', young: 'hangout', mid: 'weekend', senior: 'peaceful' };
const AGE_COPY = { teen: 'parks, museums and zoos', young: 'bridges, viewpoints, old trees, ruins and street art', mid: 'heritage, galleries and nature reserves', senior: 'gardens, ghats and old monuments' };

const QUICK = [
  { id: 'chai', label: 'Chai / sutta??', keys: () => (state.age >= 18 ? ['chai', 'sutta'] : ['chai']), line: 'Go here for chai' },
  { id: 'date', label: 'Solo date??', keys: () => ['cafe'], line: 'Table for one at' },
  { id: 'run', label: 'A run??', keys: () => ['park'], line: 'Lace up and head to' },
  { id: 'gym', label: 'Wanna get fit??', keys: () => ['gym'], line: 'Lift at' },
  { id: 'mandi', label: 'Sabji mandi', keys: () => ['mandi'], line: 'Buy your sabji at' },
  { id: 'meat', label: 'Meat shop', keys: () => ['meat'], line: 'Buy meat at' },
  { id: 'mall', label: 'Big malls', keys: () => ['mall'], line: 'Walk around' },
  { id: 'food', label: 'Famous food', keys: () => ['food'], line: 'Eat at' },
  { id: 'fashion', label: 'Keep fashion weird', keys: () => ['fashion'], line: 'Go dig through' },
  { id: 'police', label: 'Nearest thana', keys: () => ['police'], line: 'Police station:' },
  { id: 'hospital', label: 'Hospital', keys: () => ['hospital'], line: 'Hospital:' },
];

function pinIcon(cls = '') { return L.divIcon({ className: '', html: `<div class="pin ${cls}"></div>`, iconSize: [14, 14] }); }
function drawPins(places, cls) {
  state.pins.clearLayers();
  places.forEach((p) => {
    L.marker([p.lat, p.lng], { icon: pinIcon(cls) }).addTo(state.pins)
      .bindPopup(`<b>${esc(p.name || 'Unnamed spot')}</b>${p.phone ? `<br>${esc(p.phone)}` : ''}<br><a href="${dirLink(p)}" target="_blank" rel="noopener">Get directions</a>`);
  });
}
// Dossier covers part of the map, so aim at the middle of what is still visible.
function flyVisible(lat, lng, zoom) {
  const box = $('#dossier');
  const covered = box.hidden || innerWidth <= 860 ? 0 : box.offsetWidth;
  const point = state.map.project([lat, lng], zoom).add([covered / 2, 0]);
  state.map.flyTo(state.map.unproject(point, zoom), zoom);
}
function focusPlace(p) { flyVisible(p.lat, p.lng, 16); }
async function places(keys, radius) {
  const { lat, lng } = state.origin;
  const sets = await Promise.all(keys.map((key) => api('osm', { key, lat, lng, r: radius || 15000 })));
  const seen = new Set();
  return sets.flat().filter((p) => (seen.has(p.id) ? false : seen.add(p.id)));
}
const named = (list) => {
  const seen = new Set();
  return list.filter((p) => p.name && !seen.has(p.name.toLowerCase()) && seen.add(p.name.toLowerCase()));
};
const hasNoResults = (what) => `<p class="empty">No ${esc(what)} mapped here on OpenStreetMap yet.</p>`;
const failed = (what, err) => `<p class="empty">Could not load ${esc(what)}: ${esc(err.message)}. Try again in a minute.</p>`;

async function runQuick(q, btn) {
  const box = $('#pick');
  document.querySelectorAll('.quick-grid button').forEach((b) => b.classList.toggle('active', b === btn));
  box.hidden = false;
  box.innerHTML = 'Looking on the map…';
  try {
    const list = await places(q.keys());
    const pool = named(list);
    if (!pool.length) { state.pins.clearLayers(); box.innerHTML = hasNoResults('spots'); return; }
    drawPins(pool);
    const p = pool[Math.floor(Math.random() * pool.length)];
    focusPlace(p);
    box.innerHTML = `<div class="muted">${esc(q.line)}</div><h3>${esc(p.name)}</h3>
      <div class="muted">${esc(p.addr || p.kind || '')} ${p.phone ? esc(p.phone) : ''}</div>
      <div class="row"><a href="${dirLink(p)}" target="_blank" rel="noopener">Get directions</a><button id="spin">Pick another</button><span class="muted">${pool.length} on the map</span></div>`;
    $('#spin').addEventListener('click', () => runQuick(q, btn));
  } catch (err) { box.innerHTML = failed('places', err); }
}

function placeList(list, limit = 10) {
  return `<ul class="list">${named(list).slice(0, limit).map((p, i) => `<li><button class="link" data-place="${i}">${esc(p.name)}</button>
    <span class="meta">${[p.kind, p.addr, p.phone].filter(Boolean).map(esc).join(', ')}</span>
    ${p.phone ? `<a href="tel:${esc(p.phone.split(/[;,]/)[0].replace(/\s/g, ''))}">Call</a> ` : ''}<a href="${dirLink(p)}" target="_blank" rel="noopener">Directions</a></li>`).join('')}</ul>`;
}
function wirePlaces(el, list) {
  const pool = named(list);
  el.querySelectorAll('[data-place]').forEach((b) => b.addEventListener('click', () => { drawPins(pool); focusPlace(pool[Number(b.dataset.place)]); }));
}

/* Reddit */
const REDDIT_CATS = [
  ['Food', /food|eat|restaur|biryani|kebab|cafe|chai|street|chaat|dhaba/i],
  ['Hangout', /hang|chill|date|friends|night|club|bar|fun|things to do|weekend/i],
  ['Nature', /river|ghat|park|lake|garden|forest|sunset|trek|bridge|nature/i],
  ['Areas to live', /rent|flat|pg|area|locality|shift|moving|live in|safe/i],
];
const catOf = (t) => REDDIT_CATS.find(([, re]) => re.test(t))?.[0] || 'Other';
const subsFor = (d) => (SUBS[d.name] ? `${SUBS[d.name]}+uttarpradesh` : 'uttarpradesh');

async function redditBlock(el, q, { group = false } = {}) {
  const d = state.districts[state.current];
  const subs = subsFor(d);
  const webUrl = `https://www.reddit.com/r/${subs}/search?q=${encodeURIComponent(q)}&restrict_sr=1`;
  try {
    const posts = await api('reddit', { subs, q });
    if (!posts.length) { el.innerHTML = `<p class="empty">Reddit has no threads on this yet. <a href="${webUrl}" target="_blank" rel="noopener">Search Reddit yourself</a></p>`; return; }
    const render = (filter) => `<ul class="list">${posts.filter((p) => !filter || catOf(p.title) === filter).slice(0, 8).map((p) => `<li><a href="${safeUrl(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a><span class="meta">r/${esc(p.sub || subs)}, ${timeAgo(p.date)}</span></li>`).join('')}</ul>`;
    if (!group) { el.innerHTML = render(); return; }
    const cats = [...new Set(posts.map((p) => catOf(p.title)))];
    el.innerHTML = `<div class="tags">${cats.map((c, i) => `<button data-cat="${esc(c)}" aria-pressed="${i === 0}"><span>${esc(c)}</span></button>`).join('')}</div><div class="rd"></div>`;
    const show = (c) => {
      $('.rd', el).innerHTML = render(c);
      el.querySelectorAll('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.cat === c));
    };
    el.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => show(b.dataset.cat)));
    show(cats[0]);
  } catch {
    el.innerHTML = `<p class="empty">Reddit refused the request right now. <a href="${webUrl}" target="_blank" rel="noopener">Open this search on Reddit</a></p>`;
  }
}

async function newsBlock(el, q, { pins = false } = {}) {
  try {
    const items = await api('news', { q });
    if (!items.length) { el.innerHTML = '<p class="empty">No recent headlines for this search.</p>'; return; }
    const names = Object.keys(state.districts);
    const d = state.districts[state.current];
    const located = items.slice(0, 10).map((n) => {
      const hit = names.find((x) => new RegExp(`\\b${(SEARCH_NAME[x] || x).replace(/ .*/, '')}\\b`, 'i').test(n.title));
      const at = state.districts[hit] || d;
      return { ...n, place: at.name, lat: at.lat, lng: at.lng };
    });
    const drawNews = () => {
      state.newsPins.clearLayers();
      located.forEach((x, i) => L.marker([x.lat + 0.006 * i * Math.sin(i * 2.4), x.lng + 0.006 * i * Math.cos(i * 2.4)], { icon: pinIcon('news') }).addTo(state.newsPins).bindPopup(`<b>${esc(x.place)}</b><br><a href="${safeUrl(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>`));
    };
    el.innerHTML = `<ul class="list">${located.map((n, i) => `<li><a href="${safeUrl(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a>
      <span class="meta">${esc(n.source)}, ${timeAgo(n.date)}${pins ? `, <button class="link" data-news="${i}">show ${esc(n.place)}</button>` : ''}</span></li>`).join('')}</ul>`;
    if (pins) {
      drawNews();
      el.querySelectorAll('[data-news]').forEach((b) => b.addEventListener('click', () => {
        const n = located[Number(b.dataset.news)];
        flyVisible(n.lat, n.lng, 12);
      }));
      const city = state.current;
      api('geonews', { q, lat: d.lat, lng: d.lng, city: d.city.en || city }).then((spots) => {
        if (state.current !== city) return;
        spots.forEach((s) => {
          const i = located.findIndex((n) => n.url === s.url);
          if (i < 0 || !s.place) return;
          Object.assign(located[i], { place: s.place, lat: s.lat, lng: s.lng });
          const b = $(`[data-news="${i}"]`, el);
          if (b) b.textContent = `show ${s.place}`;
        });
        drawNews();
      }).catch(() => {});
    }
  } catch (err) { el.innerHTML = failed('news', err); }
}

async function peopleBlock(el, type) {
  const d = state.districts[state.current];
  if (!d.qid) { el.innerHTML = '<p class="empty">Wikidata has no entry for this district.</p>'; return; }
  try {
    const list = await api('people', { qid: d.qid, type });
    if (!list.length) { el.innerHTML = '<p class="empty">Wikidata lists nobody here yet.</p>'; return; }
    el.innerHTML = `<div class="people">${list.map((p) => `<a href="${safeUrl(p.url)}" target="_blank" rel="noopener">${p.img ? `<img loading="lazy" src="${safeUrl(p.img)}" alt="">` : '<div class="noimg"></div>'}<b>${esc(p.name)}</b><span>${esc(p.about)}</span></a>`).join('')}</div>`;
  } catch (err) { el.innerHTML = failed('names', err); }
}

/* Tabs that load their content when picked */
function tabs(el, items, show) {
  el.innerHTML = `<div class="tags">${items.map(([id, label], i) => `<button data-tab="${esc(id)}" aria-pressed="${i === 0}"><span>${esc(label)}</span></button>`).join('')}</div><div class="tab-body"></div>`;
  const open = (id) => {
    el.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tab === id));
    $('.tab-body', el).innerHTML = 'Loading…';
    show(id, $('.tab-body', el));
  };
  el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => open(b.dataset.tab)));
  open(items[0][0]);
}

/* Weather and air */
const SKY = [[0, 'Clear'], [3, 'Cloudy'], [48, 'Fog'], [67, 'Rain'], [77, 'Snow'], [82, 'Showers'], [99, 'Thunderstorm']];
const AQI = [[50, 'Good'], [100, 'Moderate'], [150, 'Bad for sensitive people'], [200, 'Unhealthy, wear a mask'], [300, 'Very unhealthy, stay in'], [999, 'Hazardous, stay in']];
async function weatherBlock(el) {
  const { lat, lng } = state.origin;
  try {
    const w = await api('weather', { lat, lng });
    el.innerHTML = `<div><dt>Temperature</dt><dd>${Math.round(w.temp)}°C<small>Feels like ${Math.round(w.feels)}°C, ${esc(SKY.find(([c]) => w.code <= c)?.[1] || '')}</small></dd></div>
      <div><dt>Air quality (US AQI)</dt><dd>${esc(w.aqi)}<small>${esc(AQI.find(([n]) => w.aqi <= n)?.[1] || '')}</small></dd></div>`;
  } catch (err) { el.innerHTML = failed('weather', err); }
}

/* Headline meters */
async function meterBlock(el, place, kind) {
  try {
    const m = await api('meter', { place, kind });
    const rows = Object.entries(m.counts).filter(([, n]) => n).sort((x, y) => y[1] - x[1]);
    if (!rows.length) { el.innerHTML = '<p class="empty">No recent headlines name any of these here.</p>'; return; }
    const top = rows[0][1];
    el.innerHTML = `<div class="bars">${rows.map(([k, n]) => `<div><span>${esc(PARTIES[k]?.name || k)}</span><i style="width:${(100 * n) / top}%"></i><span>${n}</span></div>`).join('')}</div>`;
  } catch (err) { el.innerHTML = failed('the meter', err); }
}

/* Money in the headlines */
const PAYER_COLOURS = { Centre: '#f6c400', State: '#d3201f', 'Local body': '#1e7f3a', 'Not stated': '#8a8a8a' };
const fmtCr = (n) => (n >= 100000 ? `₹${(n / 100000).toFixed(2)} lakh cr` : n >= 1 ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 1 })} cr` : `₹${(n * 100).toFixed(0)} lakh`);
async function moneyBlock(el, place) {
  try {
    const items = await api('money', { place });
    if (!items.length) { el.innerHTML = '<p class="empty">No headline in the last 90 days names a rupee amount here.</p>'; return; }
    const totals = {};
    items.forEach((n) => { totals[n.payer] = (totals[n.payer] || 0) + n.crore; });
    const sum = Object.values(totals).reduce((x, y) => x + y, 0);
    el.innerHTML = `<div class="flow" role="img" aria-label="Share of reported money by who the headline names">${Object.entries(totals).map(([k, v]) => `<i style="width:${(100 * v) / sum}%;background:${PAYER_COLOURS[k]}"></i>`).join('')}</div>
      <div class="flow-key">${Object.entries(totals).map(([k, v]) => `<span><i style="background:${PAYER_COLOURS[k]}"></i>${esc(k)}: ${fmtCr(v)}</span>`).join('')}</div>
      <ul class="list">${items.map((n) => `<li><span class="amount">${fmtCr(n.crore)}</span><a href="${safeUrl(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a><span class="meta">${esc(n.payer)}, ${esc(n.source)}, ${timeAgo(n.date)}</span></li>`).join('')}</ul>`;
  } catch (err) { el.innerHTML = failed('money news', err); }
}

/* Netas */
const mynetaUrl = (id) => (id ? `https://www.myneta.info/uttarpradesh2022/candidate.php?candidate_id=${Number(id)}` : 'https://www.myneta.info/uttarpradesh2022/');
const netaFacts = (m) => (m.vacant ? 'bye-election pending' : m.cases == null ? 'no 2022 affidavit in this data, check MyNeta' : `${m.cases} declared ${m.cases === 1 ? 'case' : 'cases'}, assets ${m.assets == null ? 'on MyNeta' : fmtCr(m.assets / 1e7)}, ${esc(m.edu)}`);
function netaList(name) {
  const list = state.netas[name] || [];
  if (!list.length) return '<p class="empty">No MLA record for this district.</p>';
  const withCases = list.filter((m) => m.cases).length;
  return `<p class="neta-sum">${list.length} seats. ${withCases} MLAs declared criminal cases in their own affidavits.</p>
    <ul class="list">${list.map((m) => { const k = partyKey(m.party); return `<li><i class="neta-party" style="background:${PARTIES[k]?.color || '#777'}"></i><a href="${mynetaUrl(m.id)}" target="_blank" rel="noopener">${esc(m.name)}</a>, ${esc(m.seat)}${m.bye ? ' (bye-election)' : ''}
      <span class="meta">${esc(PARTIES[k]?.name || m.party)}, ${netaFacts(m)}</span></li>`; }).join('')}</ul>`;
}

/* Wikipedia, Wikidata lists */
async function listBlock(el, route, what, row) {
  const d = state.districts[state.current];
  if (!d.qid) { el.innerHTML = `<p class="empty">Wikidata has no entry for this district, so no ${esc(what)}.</p>`; return; }
  try {
    const list = await api(route, { qid: d.qid });
    el.innerHTML = list.length ? `<ul class="list">${list.slice(0, 14).map(row).join('')}</ul>` : `<p class="empty">Wikidata lists no ${esc(what)} here yet.</p>`;
  } catch (err) { el.innerHTML = failed(what, err); }
}
const wdLink = (x) => `<a href="${safeUrl(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>`;

async function nearbyBlock(el) {
  const { lat, lng } = state.origin;
  try {
    const list = (await api('nearby', { lat, lng })).filter((p) => !/district$|^Lok Sabha|constituency/i.test(p.name)).slice(0, 18);
    if (!list.length) { el.innerHTML = '<p class="empty">Wikipedia has no articles within 10 km of here.</p>'; return; }
    el.innerHTML = `<div class="cards">${list.map((p, i) => `<button data-spot="${i}">${p.img ? `<img loading="lazy" src="${safeUrl(p.img)}" alt="">` : '<div class="noimg"></div>'}<b>${esc(p.name)}</b><span>${esc(p.about)}</span></button>`).join('')}</div>`;
    el.querySelectorAll('[data-spot]').forEach((b) => b.addEventListener('click', () => {
      const p = list[Number(b.dataset.spot)];
      state.pins.clearLayers();
      L.marker([p.lat, p.lng], { icon: pinIcon() }).addTo(state.pins).bindPopup(`<b>${esc(p.name)}</b><br><a href="${safeUrl(p.url)}" target="_blank" rel="noopener">Read on Wikipedia</a><br><a href="${dirLink(p)}" target="_blank" rel="noopener">Get directions</a>`).openPopup();
      focusPlace(p);
    }));
  } catch (err) { el.innerHTML = failed('landmarks', err); }
}

/* Dossier */
const loader = (fn) => ({ fn, done: false });

function closeDossier() {
  $('#dossier').hidden = true;
  state.current = null;
  state.newsPins.clearLayers();
  showStatePins();
  state.layer.setStyle(style);
}

/* Chunav mode */
const CLOSE_BINS = [{ max: 2000, color: '#ff1f1f', label: 'Under 2,000 votes' }, { max: 5000, color: '#ff8a00', label: '2,000 to 5,000' }, { max: 15000, color: '#ffd400', label: '5,000 to 15,000' }, { max: Infinity, color: '#e8e4d8', label: 'Over 15,000' }];
const chunav = { on: false, seats: null, geo: null, layer: null, view: 'party', current: null };
const DAY = 86400000;
const daysTo = (iso) => Math.ceil((new Date(`${iso}T00:00:00+05:30`) - Date.now()) / DAY);

// Words change with the calendar: expected window, announced polling, counting day, after results.
function chunavClock() {
  const { countDate, pollDates, windowStart, expected } = ELECTION;
  if (countDate) {
    const left = daysTo(countDate);
    if (left > 0) return { big: `${left} ${left === 1 ? 'day' : 'days'} to results`, small: pollDates.length ? `Polling from ${pollDates[0]}, counting ${countDate}` : `Counting ${countDate}` };
    return { big: left === 0 ? 'Results day' : 'Results are out', small: 'Open this for the Election Commission results.', results: true };
  }
  const left = daysTo(windowStart);
  return { big: left > 0 ? `About ${left} days` : 'Any day now', small: `Expected ${expected}. The Election Commission has not announced dates.` };
}

function seatStyle(f) {
  const s = chunav.seats[f.properties.no];
  const fill = chunav.view === 'party' ? PARTIES[s.party]?.color || '#777' : CLOSE_BINS.find((b) => s.margin < b.max).color;
  const on = chunav.current === s.no;
  const near = state.map.getZoom() >= 11;
  return { fillColor: fill, fillOpacity: near ? 0.12 : on ? 0.85 : 0.6, color: on ? '#fff' : '#000', weight: on ? 3 : 0.6 };
}

function seatLegend() {
  const items = chunav.view === 'party'
    ? ['BJP', 'SP', 'ADS', 'RLD', 'SBSP', 'NISHAD', 'INC', 'JDL', 'BSP'].map((k) => [PARTIES[k].color, PARTIES[k].name])
    : CLOSE_BINS.map((b) => [b.color, b.label]);
  $('#seatLegend').innerHTML = items.map(([c, l]) => `<div><i style="background:${c}"></i>${esc(l)}</div>`).join('');
}

async function loadChunav() {
  if (chunav.seats) return;
  const [seats, geo] = await Promise.all(['data/seats.json', 'data/seats.geojson'].map((u) => fetch(u).then((r) => r.json())));
  chunav.seats = seats;
  chunav.geo = geo;
  chunav.layer = L.geoJSON(geo, {
    renderer: L.canvas(), // 403 shapes are slow as SVG on phones
    style: seatStyle,
    onEachFeature(f, layer) {
      const s = seats[f.properties.no];
      layer.bindTooltip(() => `<b>${esc(s.name)}</b>${esc(s.mla.name)}<br>2022: ${esc(PARTIES[s.party]?.name || s.party)} by ${s.margin.toLocaleString('en-IN')} votes`, { sticky: true, className: 'dist-tip' });
      // Rings inside a seat are stored as polygons, so the click goes by position
      layer.on('click', (e) => { const no = seatAt(e.latlng.lat, e.latlng.lng); if (no) openSeat(no); });
    },
  });
  state.map.on('zoomend', () => { if (chunav.on) chunav.layer.setStyle(seatStyle); });

  const list = Object.values(seats);
  $('#seatPick').insertAdjacentHTML('beforeend', [...list].sort((a, b) => a.name.localeCompare(b.name)).map((s) => `<option value="${s.no}">${esc(s.name)}, ${esc(s.district)}</option>`).join(''));
  const tally = {};
  list.forEach((s) => { tally[s.party] = (tally[s.party] || 0) + 1; });
  $('#seatTally').innerHTML = Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([p, n]) => `<i style="width:${(100 * n) / list.length}%;background:${PARTIES[p]?.color || '#777'}" title="${esc(PARTIES[p]?.name || p)}: ${n}"></i>`).join('');
  $('#seatTally').setAttribute('role', 'img');
  $('#seatTally').setAttribute('aria-label', `2022 result, 202 seats needed for a majority. ${Object.entries(tally).map(([p, n]) => `${p} ${n}`).join(', ')}`);
  $('#closeSeats').innerHTML = [...list].sort((a, b) => a.margin - b.margin).slice(0, 10).map((s) => `<li><button data-seat="${s.no}">${esc(s.name)}</button>, ${s.margin.toLocaleString('en-IN')} votes</li>`).join('');
  $('#closeSeats').querySelectorAll('[data-seat]').forEach((b) => b.addEventListener('click', () => openSeat(Number(b.dataset.seat))));
}

function seatAt(lat, lng) {
  let best = null;
  let bestSize = Infinity;
  chunav.geo.features.forEach((f) => {
    f.geometry.coordinates.forEach((poly) => {
      if (!inRing(lng, lat, poly[0])) return;
      const xs = poly[0].map((p) => p[0]);
      const ys = poly[0].map((p) => p[1]);
      const size = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
      if (size < bestSize) { bestSize = size; best = f.properties.no; }
    });
  });
  return best;
}

async function setChunav(on) {
  chunav.on = on;
  $('#chunavBtn').setAttribute('aria-pressed', on);
  $('#chunavPanel').hidden = !on;
  $('#rolaPanel').hidden = on;
  $('.find').hidden = on;
  if (on) {
    await loadChunav();
    state.layer.remove();
    chunav.layer.addTo(state.map);
    chunav.layer.setStyle(seatStyle);
    seatLegend();
    const saved = Number(store.get('seat'));
    if (saved && chunav.seats[saved]) $('#seatHits').innerHTML = `<button data-saved>Your seat: <b>${esc(chunav.seats[saved].name)}</b></button>`;
    $('[data-saved]')?.addEventListener('click', () => openSeat(saved));
    if (chunavClock().results) $('#seatHits').insertAdjacentHTML('afterbegin', `<p><a href="${ELECTION.results}" target="_blank" rel="noopener"><b>See results on the Election Commission site</b></a></p>`);
  } else {
    chunav.current = null;
    chunav.layer?.remove();
    state.layer.addTo(state.map);
    if (!$('#dossier').hidden) closeDossier();
  }
}

async function findSeat(e) {
  e.preventDefault();
  const q = $('#seatQ').value.trim();
  const hits = $('#seatHits');
  if (!q) return;
  hits.textContent = 'Looking…';
  try {
    const places2 = await api('geocode', { q });
    const found = places2.map((p) => ({ ...p, no: seatAt(p.lat, p.lng) })).filter((p) => p.no);
    if (!found.length) { hits.textContent = 'No place by that name in UP. Try a nearby town or pick a seat below.'; return; }
    hits.innerHTML = found.map((p, i) => `<button data-hit="${i}">${esc(p.name)}<small>${esc(p.label)}${p.label ? ', ' : ''}${esc(chunav.seats[p.no].name)} seat</small></button>`).join('');
    hits.querySelectorAll('[data-hit]').forEach((b) => b.addEventListener('click', () => {
      const p = found[Number(b.dataset.hit)];
      openSeat(p.no, p);
    }));
  } catch (err) { hits.textContent = `Search failed: ${err.message}. Pick a seat below instead.`; }
}

function seatFromGps() {
  const hits = $('#seatHits');
  if (!navigator.geolocation) { hits.textContent = 'This browser has no location. Type your area instead.'; return; }
  hits.textContent = 'Finding you…';
  navigator.geolocation.getCurrentPosition((pos) => {
    const { latitude: lat, longitude: lng } = pos.coords;
    const no = seatAt(lat, lng);
    if (!no) { hits.textContent = 'You are outside Uttar Pradesh. Type your area instead.'; return; }
    hits.textContent = '';
    openSeat(no, { lat, lng, name: 'You are here' });
  }, () => { hits.textContent = 'Location was blocked. Type your area instead.'; }, { timeout: 10000 });
}

function openSeat(no, place) {
  const s = chunav.seats[no];
  chunav.current = no;
  store.set('seat', no);
  chunav.layer.setStyle(seatStyle);
  state.current = s.district;
  state.pins.clearLayers();
  state.newsPins.clearLayers();
  showStatePins();
  $('#seatPick').value = no;
  if (place) L.marker([place.lat, place.lng], { icon: pinIcon('hot') }).addTo(state.pins).bindPopup(esc(place.name));

  const box = $('#dossier');
  box.hidden = false;
  box.scrollTop = 0;
  const shape = chunav.layer.getLayers().find((l) => l.feature.properties.no === no);
  if (shape) state.map.flyToBounds(shape.getBounds(), { paddingBottomRight: [innerWidth <= 860 ? 0 : box.offsetWidth, 0], maxZoom: 12 });

  const list = Object.values(chunav.seats).sort((a, b) => a.margin - b.margin);
  const rank = list.findIndex((x) => x.no === no) + 1;
  const pName = (p) => PARTIES[NETA_PARTY[p] || p]?.name || p;
  const pColour = (p) => PARTIES[NETA_PARTY[p] || p]?.color || '#777';
  const m = s.mla;
  const top = Math.max(s.votes, s.runnerVotes);
  const clock = chunavClock();
  const search = `${s.name} ${s.district}`;

  box.innerHTML = `
  <button class="close" id="closeBtn" aria-label="Close seat page">X</button>
  <header class="masthead">
    <h1 class="city-en">${esc(s.name)}</h1>
    <dl class="facts">
      <div><dt>Assembly seat</dt><dd>No. ${s.no}${s.reserved ? `, reserved ${esc(s.reserved)}` : ''}</dd></div>
      <div><dt>District</dt><dd><button class="link-btn on-red" id="seatCity" type="button">${esc(s.district)}</button></dd></div>
      <div><dt>Lok Sabha seat</dt><dd>${esc(s.lokSabha)}</dd></div>
      <div><dt>Chunav 2027</dt><dd>${esc(clock.big)}</dd></div>
    </dl>
  </header>

  <section class="sec sec-black">
    <img src="img/10.jpg" alt="Poster: Aapna kya lena dena">
    <div><h2>Your MLA now</h2>
      <h3><a href="${mynetaUrl(m.id)}" target="_blank" rel="noopener">${esc(m.name)}</a></h3>
      <p class="lead">${m.vacant ? 'Wikipedia lists a bye-election as still to come for this seat.' : `${esc(pName(m.party))}${m.bye ? ', won a bye-election after 2022' : ''}. ${netaFacts(m)}.`}</p>
      <p class="muted">Their own 2022 affidavit, collected by ADR on MyNeta. Declared cases are not convictions.</p>
    </div>
  </section>

  <section class="sec sec-amber">
    <img src="img/15.jpg" alt="No U-turn road sign">
    <div><h2>Last fight, 2022</h2>
      <div class="big-margin">${s.margin.toLocaleString('en-IN')} votes</div>
      <p class="lead">That was the gap. ${rank <= 40 ? `Number ${rank} closest of 403 seats.` : `It ranks ${rank} of 403, where 1 is the closest.`} Turnout ${s.turnout}%.</p>
      <div class="fight">
        <div><small><b>${esc(s.winner)}</b>, ${esc(pName(s.party))}: ${s.votes.toLocaleString('en-IN')} (${s.pct}%)</small><div class="fight-bar" style="width:${(100 * s.votes) / top}%;background:${pColour(s.party)}"></div></div>
        <div><small><b>${esc(s.runner)}</b>, ${esc(pName(s.runnerParty))}: ${s.runnerVotes.toLocaleString('en-IN')} (${s.runnerPct}%)</small><div class="fight-bar" style="width:${(100 * s.runnerVotes) / top}%;background:${pColour(s.runnerParty)}"></div></div>
      </div>
    </div>
  </section>

  <section class="sec sec-paper">
    <img src="img/18.jpg" alt="Wake up, on an old phone screen">
    <div><h2>Is your name on the list?</h2>
      <p class="lead"><b>Check even if you voted last time.</b> UP's voter list was redone in 2025 and 2026, and the final roll came out about 2 crore names shorter.</p>
      ${state.age && state.age < 18 ? '<p class="lead">You are under 18, so show this to someone who can vote.</p>' : ''}
      <ol class="vote-steps">
        <li><a href="${ELECTION.roll}" target="_blank" rel="noopener">Search your name on the voter list</a>. The result also names your polling booth.</li>
        <li>Not there? <a href="${ELECTION.form6}" target="_blank" rel="noopener">File Form 6 on the voter portal</a>, or ask your booth level officer.</li>
        <li>Stuck? Call the voter helpline on <a href="tel:${ELECTION.helpline}">${ELECTION.helpline}</a>.</li>
      </ol>
    </div>
  </section>

  <section class="sec sec-red">
    <img src="img/12.jpg" alt="Film-style poster with a burning car">
    <div><h2>Who's standing in 2027</h2>
      <div id="cands">Checking MyNeta…</div>
      <h3>Latest on this seat</h3><div id="seatNews">Loading…</div>
      <h3>UP election news</h3><div id="upNews">Loading…</div>
    </div>
  </section>`;

  $('#closeBtn').addEventListener('click', () => { chunav.current = null; closeDossier(); if (chunav.on) chunav.layer.setStyle(seatStyle); });
  $('#seatCity').addEventListener('click', () => { setChunav(false).then(() => openCity(s.district)); });
  api('candidates', {}).then((c) => {
    $('#cands').innerHTML = c.ready
      ? `<p class="lead"><a href="${safeUrl(c.url)}" target="_blank" rel="noopener">Candidate affidavits are up on MyNeta</a>. Compare their assets with the 2022 figures here.</p>`
      : '<p class="lead">Nobody official yet. Candidates file affidavits after the schedule is announced, and this box links to them as soon as MyNeta opens its 2027 page.</p>';
  }).catch(() => { $('#cands').innerHTML = '<p class="lead">Could not reach MyNeta. <a href="https://www.myneta.info/" target="_blank" rel="noopener">Check it yourself</a>.</p>'; });
  newsBlock($('#seatNews'), `"${s.name}" ${s.district} MLA OR vidhan sabha OR assembly OR 2027`);
  newsBlock($('#upNews'), 'Uttar Pradesh assembly election 2027 when:7d');
}

function initChunav() {
  const paint = () => {
    const c = chunavClock();
    $('#chunavClock').textContent = `${c.big}. ${c.small}`;
  };
  paint();
  setInterval(paint, 3600000);
  $('#chunavBtn').addEventListener('click', () => setChunav(!chunav.on));
  $('#seatForm').addEventListener('submit', findSeat);
  $('#seatGps').addEventListener('click', seatFromGps);
  $('#seatPick').addEventListener('change', (e) => { if (e.target.value) openSeat(Number(e.target.value)); });
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
    chunav.view = b.dataset.view;
    document.querySelectorAll('[data-view]').forEach((x) => x.setAttribute('aria-checked', x === b));
    chunav.layer.setStyle(seatStyle);
    seatLegend();
  }));
}

function openCity(name, origin) {
  const d = state.districts[name];
  state.current = name;
  state.origin = origin || { lat: d.lat, lng: d.lng };
  state.layer.setStyle(style);
  state.pins.clearLayers();
  state.newsPins.clearLayers();
  showStatePins();
  if (origin) L.marker([origin.lat, origin.lng], { icon: pinIcon('hot') }).addTo(state.pins).bindPopup('You are here');
  $('#districtPick').value = name;

  const search = SEARCH_NAME[name] || d.city.en || name;
  const seats = d.seats.map((s) => `${esc(s.seat)}: ${esc(s.mp || 'MP')} (${esc(PARTIES[s.party]?.name || s.party)})`).join('<br>');
  const plate = Object.entries(RTO).find(([, v]) => v === name || v === SEARCH_NAME[name])?.[0];
  const mapsUrl = (q) => `https://www.google.com/maps/search/${encodeURIComponent(q)}`;
  const underTabs = [...UNDER_TABS].sort((x, y) => y.ages.includes(ageBand()) - x.ages.includes(ageBand()));
  const projects = PROJECTS.filter((p) => p.districts.includes(name));
  const hist = HISTORY[name] || [];
  const newsUrl = (q) => `https://news.google.com/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`;

  const box = $('#dossier');
  box.hidden = false;
  box.scrollTop = 0;
  flyVisible(state.origin.lat, state.origin.lng, origin ? 13 : 11);
  box.innerHTML = `
  <button class="close" id="closeBtn" aria-label="Close city page">X</button>
  <header class="masthead">
    <h1 class="city-en">${esc(d.city.en || name)}</h1>
    <div class="city-tri">
      ${d.city.hi ? `<span class="city-hi" lang="hi">${esc(d.city.hi)}</span>` : ''}
      ${d.city.ur ? `<span class="city-ur" lang="ur" dir="rtl">${esc(d.city.ur)}</span>` : ''}
    </div>
    <dl class="facts">
      <div id="hereNow" hidden><dt>You are in</dt><dd></dd></div>
      <div><dt>District</dt><dd>${esc(name)}</dd></div>
      ${OLD_NAMES[name] ? `<div><dt>Older names</dt><dd>${esc(OLD_NAMES[name])}</dd></div>` : ''}
      <div><dt>2024 Lok Sabha winner</dt><dd>${seats}</dd></div>
      <div><dt>MLAs by party</dt><dd>${mlaCounts(name).map(([p, n]) => `${esc(PARTIES[p]?.name || p)} ${n}`).join(', ')}</dd></div>
      ${ODOP[name] ? `<div><dt>Known for making</dt><dd>${esc(ODOP[name])}</dd></div>` : ''}
      ${d.census ? `<div><dt>Census 2011</dt><dd>${(d.census.pop / 1e5).toFixed(1)} lakh people, ${d.census.share}% Muslim</dd></div>` : ''}
      ${BLOCS[name] ? `<div><dt>Blocs the press names</dt><dd>${esc(BLOCS[name])}</dd></div>` : ''}
      ${plate ? `<div><dt>Plate code</dt><dd>UP ${plate}</dd></div>` : ''}
    </dl>
  </header>

  <section class="sec sec-red" data-load="survive">
    <img src="img/17.jpg" alt="Comic lettering: Ahhhhh!">
    <div><h2>Survive today</h2>
      <dl class="now" id="now">Loading…</dl>
      <div class="help">${HELPLINES.map(([n, l]) => `<a href="tel:${n}"><b>${n}</b><span>${esc(l)}</span></a>`).join('')}</div>
    </div>
  </section>

  <section class="quick">
    <h2>Abhi kya karna hai?</h2>
    <div class="quick-grid">${QUICK.map((q) => `<button data-q="${q.id}">${esc(q.label)}</button>`).join('')}</div>
    <div class="pick" id="pick" hidden></div>
  </section>

  <section class="sec sec-amber" data-load="news">
    <img src="img/18.jpg" alt="Wake up, on an old phone screen">
    <div><h2>News in ${esc(search)}</h2><div id="news">Loading headlines…</div>
      <h3>Who has the rola in the headlines</h3>
      <p class="lead">Counts names in the last 30 days of headlines. This shows who the press writes about, which is different from who has support.</p>
      <div id="meterParty">Loading…</div>
      <h3>Which samaj the political news names</h3>
      <p class="lead">Last 90 days, district level only. Headline mentions, not population.</p>
      <div id="meterSamaj">Loading…</div>
    </div>
  </section>

  <section class="sec sec-red" data-load="netas">
    <img src="img/12.jpg" alt="Film-style poster with a burning car">
    <div><h2>Netas</h2>
      <p class="lead">Their own 2022 election affidavits, collected by ADR on MyNeta. Declared cases are not convictions. Figures may have changed since.</p>
      <p><button class="action" id="toChunav" type="button">Find your seat in Chunav 2027</button></p>
      <div id="netaList">${netaList(name)}</div>
      <h3>Party offices on the map</h3><div id="partyOffices">Loading…</div>
      <h3>Netas in the news</h3><div id="netaNews">Loading…</div>
    </div>
  </section>

  <section class="sec sec-paper" data-load="lawyers">
    <img src="img/10.jpg" alt="Poster: Aapna kya lena dena">
    <div><h2>Lawyers</h2>
      <p class="lead">Nobody publishes who wins the most, so nothing here is a ranking. These are mapped offices with listed numbers, real case news, and lawyers people actually recommend.</p>
      <p class="lead"><b>Free legal aid: call NALSA on 15100.</b> <a href="https://services.ecourts.gov.in/" target="_blank" rel="noopener">Check any lawyer's cases on eCourts</a>.</p>
      <h3>Check a lawyer's record</h3>
      <div class="lookup"><input id="lawyerName" aria-label="Lawyer's name" placeholder="Type a lawyer's name"><a id="lawyerGo" href="https://indiankanoon.org/" target="_blank" rel="noopener">Search judgments</a></div>
      <p class="muted">Indian Kanoon shows judgments naming that lawyer. Read them to see who won, since no site keeps a score.</p>
      <h3>By type of case</h3><div id="lawCats"></div>
      <h3>Offices and courts on the map</h3><div id="lawyers">Loading…</div>
      <h3>Cases against netas in the news</h3><div id="lawNews">Loading…</div>
      <h3>Reddit recommendations</h3><div id="lawReddit">Loading…</div>
      <h3>Lawyers from here</h3><div id="lawPeople">Loading…</div>
    </div>
  </section>

  <section class="sec sec-black" data-load="projects">
    <img src="img/11.jpg" alt="Poster: Don't waste your time on these bakwass things">
    <div><h2>Your tax money</h2>
      ${projects.length ? projects.map((p) => `<div class="project"><b>${esc(p.name)}</b>${esc(p.cost)}${p.km ? `, ${esc(p.km)}` : ''}<br>
        <a href="https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(p.name)}" target="_blank" rel="noopener">Background</a>
        <a href="${newsUrl(`${p.name} progress`)}" target="_blank" rel="noopener">Latest status</a></div>`).join('') : '<p class="lead">No big state project on this list passes through here. Local work shows up in the news below.</p>'}
      <h3>Money named in headlines</h3>
      <p class="muted">Rupee amounts in the last 90 days of news, grouped by who the headline names. This is announced money, and a headline can repeat or overlap another.</p>
      <div id="moneyNews">Loading…</div>
      <h3>Follow the rupee yourself</h3>
      <p class="muted">Costs are press-reported totals and may have changed. No public feed gives rupee-by-rupee spending, so use these portals or file an RTI:</p>
      <ul class="list">${MONEY_LINKS.map((m) => `<li><a href="${m.url}" target="_blank" rel="noopener">${esc(m.label)}</a></li>`).join('')}</ul>
      <h3>Live project news</h3><div id="projectNews">Loading…</div>
    </div>
  </section>

  <section class="sec sec-paper" data-load="papers">
    <img src="img/15.jpg" alt="No U-turn road sign">
    <div><h2>No papers yet?</h2>
      ${PAPERS.map((p) => `<details class="paper-card" data-paper="${p.key}"><summary>${esc(p.title)}</summary>
        <p><b>Time:</b> ${esc(p.time)}</p><ol class="steps">${p.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        <a href="${p.link.url}" target="_blank" rel="noopener">${esc(p.link.label)}</a>
        <h3>${esc(p.place)} near you</h3><div class="paper-places">Open to load…</div>
        <h3>What Reddit says</h3><div class="paper-reddit"></div></details>`).join('')}
    </div>
  </section>

  <section class="sec sec-red" data-load="underrated">
    <img src="img/3.jpg" alt="Painted sign: Why not">
    <div><h2>Underrated</h2>
      <p class="lead">Age ${esc(state.age || '?')} here, so you get ${AGE_COPY[ageBand()]}.</p>
      <div id="under">Loading…</div>
      <h3>Rivers, pul, trees, paintings</h3><div id="underTabs"></div>
      <h3>Near here on Wikipedia</h3><div id="nearby">Loading…</div>
      <h3>Popular areas on Reddit</h3><div id="underReddit"></div>
    </div>
  </section>

  <section class="sec sec-black" data-load="origins">
    <img src="img/19.jpg" alt="Title card: Directed by">
    <div><h2>Who comes from here</h2>
      <p class="lead">Birthplaces from Wikidata. Home addresses of living people stay off this site.</p>
      <h3>Actors</h3><div id="pActor">Loading…</div>
      <h3>Netas</h3><div id="pNeta">Loading…</div>
    </div>
  </section>

  <section class="sec sec-paper" data-load="films">
    <img src="img/1.jpg" alt="Black and white photo of a man with a cigarette">
    <div><h2>Filmy</h2>
      <h3>Films shot or set here</h3><div id="films">Loading…</div>
      <h3>Stars around town, in the news</h3><div id="starNews">Loading…</div>
    </div>
  </section>

  <section class="sec sec-green" data-load="culture">
    <img src="img/16.jpg" alt="DJ road sign">
    <div><h2>Sound, art, history</h2>
      <div id="wiki">Loading…</div>
      ${MUSIC[name] ? `<h3>Music from here</h3><p>${esc(MUSIC[name])}</p>` : ''}
      ${CRAFT[name] || ODOP[name] ? `<h3>Art and craft</h3><p>${esc([...new Set([ODOP[name], CRAFT[name]].filter(Boolean))].join('. '))}</p>` : ''}
      <h3>Moments on record</h3><div id="events">Loading…</div>
      ${hist.length ? `<h3>What happened here</h3><ul class="list">${hist.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
      <h3>Musicians</h3><div id="pMusic">Loading…</div>
      <h3>Writers and poets</h3><div id="pArt">Loading…</div>
    </div>
  </section>

  <section class="sec sec-paper" data-load="food">
    <img src="img/13.jpg" alt="Poster: Please don't kill my vibe">
    <div><h2>Where people eat</h2>
      <h3>Restaurants nearby</h3><div id="eat">Loading…</div>
      <h3>Famous, per Reddit</h3><div id="eatReddit">Loading…</div>
      <h3>Star spottings in the news</h3><div id="eatNews">Loading…</div>
    </div>
  </section>

  <section class="sec sec-green" data-load="fashion">
    <img src="img/14.jpg" alt="Poster: Keep fashion weird">
    <div><h2>Kapde</h2>
      <h3>Bazaars, tailors, clothes shops</h3><div id="fashion">Loading…</div>
      <h3>What Reddit says</h3><div id="fashionReddit">Loading…</div>
    </div>
  </section>

  <section class="sec sec-black" data-load="rich">
    <img src="img/2.jpg" alt="Playing card: No pressure, no diamonds">
    <div><h2>Old money</h2>
      <h3>Companies based here</h3><div id="companies">Loading…</div>
      <h3>Richest MLAs by their own affidavit</h3>
      <ul class="list">${[...(state.netas[name] || [])].filter((m) => m.assets).slice(0, 3).map((m) => `<li><a href="${mynetaUrl(m.id)}" target="_blank" rel="noopener">${esc(m.name)}</a><span class="meta">${fmtCr(m.assets / 1e7)}, ${esc(m.seat)}</span></li>`).join('')}</ul>
      <h3>Business people born here</h3><div id="richPeople">Loading…</div>
      <h3>Rich-list news</h3><div id="richNews">Loading…</div>
    </div>
  </section>

  <section class="sec sec-amber" data-load="cars">
    <img src="img/20.jpg" alt="Black SUV with tinted windows">
    <div><h2>Big cars</h2>
      <p class="lead">Type a plate to see where it was registered. Owner lookups stay out: tying a plate to a person is how people get stalked.</p>
      <div class="plate"><input id="plateIn" aria-label="Number plate" placeholder="UP32 AB 1234" maxlength="13"><output id="plateOut"></output></div>
      <h3>Big-car showrooms</h3><div id="showrooms">Loading…</div>
      <h3>VIP number auctions in the news</h3><div id="vipNews">Loading…</div>
    </div>
  </section>`;

  $('#closeBtn').addEventListener('click', closeDossier);
  box.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => runQuick(QUICK.find((q) => q.id === b.dataset.q), b)));

  $('#plateIn').addEventListener('input', (e) => {
    const m = e.target.value.toUpperCase().match(/^UP\s*(\d{2})/);
    $('#plateOut').textContent = !m ? (e.target.value.length > 3 ? 'Not a UP plate' : '') : RTO[Number(m[1])] ? `Registered at the ${RTO[Number(m[1])]} RTO` : 'Unknown UP code';
  });
  $('#toChunav').addEventListener('click', () => { box.hidden = true; state.current = null; setChunav(true); });
  $('#lawyerName').addEventListener('input', (e) => {
    const n = e.target.value.trim();
    $('#lawyerGo').href = n ? `https://indiankanoon.org/search/?formInput=${encodeURIComponent(`"${n}" doctypes:allahabad`)}` : 'https://indiankanoon.org/';
  });

  box.querySelectorAll('.paper-card').forEach((card) => card.addEventListener('toggle', async () => {
    if (!card.open || card.dataset.loaded) return;
    card.dataset.loaded = '1';
    const p = PAPERS.find((x) => x.key === card.dataset.paper);
    const slot = $('.paper-places', card);
    redditBlock($('.paper-reddit', card), `${p.reddit} ${search}`);
    try {
      const list = await places([p.osm], p.radius || 25000);
      slot.innerHTML = named(list).length ? placeList(list, 6) : `${hasNoResults(p.place.toLowerCase())}<a href="https://www.google.com/maps/search/${encodeURIComponent(`${p.title} office ${search}`)}" target="_blank" rel="noopener">Search on Google Maps</a>`;
      wirePlaces(slot, list);
    } catch (err) { slot.innerHTML = failed('offices', err); }
  }));

  const placeBlock = async (el, key, what, radius = 20000, sift = (x) => x) => {
    try {
      const list = sift(await places([key], radius));
      const look = `<p><a href="${mapsUrl(`${what} ${search}`)}" target="_blank" rel="noopener">Look for ${esc(what)} on Google Maps</a></p>`;
      el.innerHTML = named(list).length ? placeList(list) + look : hasNoResults(what) + look;
      wirePlaces(el, list);
    } catch (err) { el.innerHTML = failed(what, err); }
  };
  const LUXURY = /mercedes|bmw|audi|jaguar|land rover|porsche|lexus|volvo|toyota|mahindra/i;

  const loaders = {
    survive: () => weatherBlock($('#now')),
    news: () => {
      newsBlock($('#news'), `${search} Uttar Pradesh when:7d`, { pins: true });
      meterBlock($('#meterParty'), search, 'party');
      meterBlock($('#meterSamaj'), search, 'samaj');
    },
    netas: () => {
      placeBlock($('#partyOffices'), 'party', 'party offices', 25000);
      newsBlock($('#netaNews'), `${search} MLA OR MP OR minister when:14d`);
    },
    films: () => {
      listBlock($('#films'), 'films', 'films', (f) => `<li>${wdLink(f)}<span class="meta">${esc(f.year || '')}</span></li>`);
      newsBlock($('#starNews'), `actor shooting OR visited ${search} when:90d`);
    },
    fashion: () => {
      placeBlock($('#fashion'), 'fashion', 'clothes shops', 12000);
      redditBlock($('#fashionReddit'), `shopping market clothes thrift ${search}`);
    },
    rich: () => {
      listBlock($('#companies'), 'companies', 'companies', (c) => `<li>${wdLink(c)}<span class="meta">${[c.about, c.year && `since ${c.year}`, c.founder && `founded by ${c.founder}`].filter(Boolean).map(esc).join(', ')}</span></li>`);
      peopleBlock($('#richPeople'), 'business');
      newsBlock($('#richNews'), `${search} billionaire OR crorepati OR businessman family company`);
    },
    cars: () => {
      placeBlock($('#showrooms'), 'car', 'car showrooms', 20000, (l) => l.sort((x, y) => LUXURY.test(y.name || '') - LUXURY.test(x.name || '')));
      newsBlock($('#vipNews'), `${search} VIP number auction car registration`);
    },
    lawyers: async () => {
      try {
        const list = await places(['lawyer'], 20000);
        const slot = $('#lawyers');
        slot.innerHTML = named(list).length ? placeList(list) : hasNoResults('lawyers');
        wirePlaces(slot, list);
      } catch (err) { $('#lawyers').innerHTML = failed('lawyers', err); }
      tabs($('#lawCats'), LAW_CATS.map((c) => [c.label, c.label]), (id, body) => {
        const c = LAW_CATS.find((x) => x.label === id);
        body.innerHTML = `<div class="lookup"><a href="${mapsUrl(`${c.maps} ${search}`)}" target="_blank" rel="noopener">Numbers and reviews on Google Maps</a></div><div class="law-news">Loading…</div>`;
        newsBlock($('.law-news', body), `${search} ${c.q}`);
      });
      newsBlock($('#lawNews'), `${search} advocate case against MLA court`);
      redditBlock($('#lawReddit'), `lawyer advocate ${search}`);
      peopleBlock($('#lawPeople'), 'lawyer');
    },
    projects: () => {
      moneyBlock($('#moneyNews'), search);
      newsBlock($('#projectNews'), `${search} project crore sanctioned OR completed OR inaugurated`);
    },
    underrated: async () => {
      const slot = $('#under');
      try {
        const list = await places([ageBand()], 30000);
        const pool = named(list).sort(() => Math.random() - 0.5);
        slot.innerHTML = pool.length ? placeList(pool, 10) : hasNoResults('spots of this type');
        wirePlaces(slot, pool);
      } catch (err) { slot.innerHTML = failed('spots', err); }
      tabs($('#underTabs'), underTabs.map((t) => [t.key, t.label]), (key, body) => placeBlock(body, key, UNDER_TABS.find((t) => t.key === key).label.toLowerCase(), 30000));
      nearbyBlock($('#nearby'));
      tabs($('#underReddit'), [[`underrated OR hidden OR ${AGE_WORDS[ageBand()]}`, 'Underrated'], ...AREA_CATS.map(([l, q]) => [q, l])], (q, body) => redditBlock(body, q));
    },
    origins: () => { peopleBlock($('#pActor'), 'actor'); peopleBlock($('#pNeta'), 'neta'); },
    culture: async () => {
      peopleBlock($('#pMusic'), 'music'); peopleBlock($('#pArt'), 'art');
      listBlock($('#events'), 'events', 'events', (e) => `<li>${e.year ? `${esc(e.year)}: ` : ''}${wdLink(e)}<span class="meta">${esc(e.about)}</span></li>`);
      try {
        const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent((d.city.en || name).replace(/ /g, '_'))}`);
        const j = await r.json();
        $('#wiki').innerHTML = j.extract ? `<p class="lead">${esc(j.extract)}</p>` : '';
      } catch { $('#wiki').innerHTML = ''; }
    },
    food: async () => {
      try {
        const list = await places(['food'], 12000);
        const slot = $('#eat');
        slot.innerHTML = named(list).length ? placeList(list.sort(() => Math.random() - 0.5), 8) : hasNoResults('restaurants');
        wirePlaces(slot, list);
      } catch (err) { $('#eat').innerHTML = failed('restaurants', err); }
      redditBlock($('#eatReddit'), `best food famous restaurant ${search}`);
      newsBlock($('#eatNews'), `actor visited restaurant ${search} favourite`);
    },
  };

  state.io?.disconnect();
  state.io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    state.io.unobserve(en.target);
    loaders[en.target.dataset.load]?.();
  }), { root: box, rootMargin: '200px' });
  box.querySelectorAll('[data-load]').forEach((s) => state.io.observe(s));
}

intro();
initMap();
initChunav();
