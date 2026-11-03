import { PARTIES, SUBS, SEARCH_NAME, OLD_NAMES, CRAFT, MUSIC, HISTORY, BLOCS, RTO, PROJECTS, MONEY_LINKS, PAPERS } from './content.js';

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

const state = { age: Number(store.get('age')) || null, mode: 'party', districts: {}, current: null, origin: null, geo: null };

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

function style(feature) {
  const d = state.districts[feature.properties.district];
  let fill = '#777';
  let dash = null;
  if (state.mode === 'party') {
    fill = PARTIES[d.seats[0]?.party]?.color || '#777';
    if (new Set(d.seats.map((s) => s.party)).size > 1) dash = '6 5';
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
  const share = d.census ? `Muslim ${d.census.share}%, mostly Hindu otherwise` : 'No separate 2011 figure';
  return `<b>${esc(name)}</b>${share}${BLOCS[name] ? `<br>Press-named blocs: ${esc(BLOCS[name])}` : ''}`;
}

function renderLegend() {
  const items = state.mode === 'party'
    ? Object.values(PARTIES).map((p) => [p.color, p.name])
    : [...SHARE_BINS.map((b) => [b.color, b.label]), ['#777', 'No separate figure']];
  $('#legend').innerHTML = items.map(([c, l]) => `<div><i style="background:${c}"></i>${esc(l)}</div>`).join('');
  $('#legendNote').textContent = state.mode === 'party'
    ? 'Winner of the 2024 Lok Sabha seat for each district. Dashed outline: seats in this district went to different parties.'
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

  const [districts, geo] = await Promise.all([fetch('data/districts.json').then((r) => r.json()), fetch('data/up.geojson').then((r) => r.json())]);
  state.districts = districts;
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
    el.innerHTML = `<ul class="list">${located.map((n, i) => `<li><a href="${safeUrl(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a>
      <span class="meta">${esc(n.source)}, ${timeAgo(n.date)}${pins ? `, <button class="link" data-news="${i}">show ${esc(n.place)}</button>` : ''}</span></li>`).join('')}</ul>`;
    if (pins) {
      el.querySelectorAll('[data-news]').forEach((b) => b.addEventListener('click', () => {
        const n = located[Number(b.dataset.news)];
        state.pins.clearLayers();
        located.forEach((x) => L.marker([x.lat, x.lng], { icon: pinIcon('news') }).addTo(state.pins).bindPopup(`<a href="${safeUrl(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>`));
        flyVisible(n.lat, n.lng, 10);
      }));
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

/* Dossier */
const loader = (fn) => ({ fn, done: false });

function openCity(name, origin) {
  const d = state.districts[name];
  state.current = name;
  state.origin = origin || { lat: d.lat, lng: d.lng };
  state.layer.setStyle(style);
  state.pins.clearLayers();
  if (origin) L.marker([origin.lat, origin.lng], { icon: pinIcon('hot') }).addTo(state.pins).bindPopup('You are here');
  $('#districtPick').value = name;

  const search = SEARCH_NAME[name] || d.city.en || name;
  const seats = d.seats.map((s) => `${esc(s.seat)}: ${esc(s.mp || 'MP')} (${esc(PARTIES[s.party]?.name || s.party)})`).join('<br>');
  const plate = Object.entries(RTO).find(([, v]) => v === name)?.[0];
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
      <div><dt>District</dt><dd>${esc(name)}</dd></div>
      ${OLD_NAMES[name] ? `<div><dt>Older names</dt><dd>${esc(OLD_NAMES[name])}</dd></div>` : ''}
      <div><dt>2024 Lok Sabha winner</dt><dd>${seats}</dd></div>
      ${d.census ? `<div><dt>Census 2011</dt><dd>${(d.census.pop / 1e5).toFixed(1)} lakh people, ${d.census.share}% Muslim</dd></div>` : ''}
      ${BLOCS[name] ? `<div><dt>Blocs the press names</dt><dd>${esc(BLOCS[name])}</dd></div>` : ''}
      ${plate ? `<div><dt>Plate code</dt><dd>UP ${plate}</dd></div>` : ''}
    </dl>
  </header>

  <section class="quick">
    <h2>Abhi kya karna hai?</h2>
    <div class="quick-grid">${QUICK.map((q) => `<button data-q="${q.id}">${esc(q.label)}</button>`).join('')}</div>
    <div class="pick" id="pick" hidden></div>
  </section>

  <section class="sec sec-amber" data-load="news">
    <img src="img/18.jpg" alt="Wake up, on an old phone screen">
    <div><h2>News in ${esc(search)}</h2><div id="news">Loading headlines…</div></div>
  </section>

  <section class="sec sec-paper" data-load="lawyers">
    <img src="img/10.jpg" alt="Poster: Aapna kya lena dena">
    <div><h2>Lawyers</h2>
      <p class="lead">Nobody publishes who wins the most, so nothing here is a ranking. These are mapped offices with listed numbers, real case news, and lawyers people actually recommend.</p>
      <p class="lead"><b>Free legal aid: call NALSA on 15100.</b> <a href="https://services.ecourts.gov.in/" target="_blank" rel="noopener">Check any lawyer's cases on eCourts</a>.</p>
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
      <h3>From Reddit, by type</h3><div id="underReddit">Loading…</div>
    </div>
  </section>

  <section class="sec sec-black" data-load="origins">
    <img src="img/19.jpg" alt="Title card: Directed by">
    <div><h2>Who comes from here</h2>
      <p class="lead">Birthplaces from Wikidata. Home addresses of living people stay off this site.</p>
      <h3>Actors</h3><div id="pActor">Loading…</div>
      <h3>Netas</h3><div id="pNeta">Loading…</div>
      <h3>Business names and old money</h3><div id="pBusiness">Loading…</div>
    </div>
  </section>

  <section class="sec sec-green" data-load="culture">
    <img src="img/16.jpg" alt="DJ road sign">
    <div><h2>Sound, art, history</h2>
      <div id="wiki">Loading…</div>
      ${MUSIC[name] ? `<h3>Music from here</h3><p>${esc(MUSIC[name])}</p>` : ''}
      ${CRAFT[name] ? `<h3>Art and craft</h3><p>${esc(CRAFT[name])}</p>` : ''}
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

  <section class="sec sec-amber">
    <img src="img/20.jpg" alt="Black SUV with tinted windows">
    <div><h2>Big cars</h2>
      <p class="lead">Type a plate to see where it was registered. Owner lookups stay out: tying a plate to a person is how people get stalked.</p>
      <div class="plate"><input id="plateIn" aria-label="Number plate" placeholder="UP32 AB 1234" maxlength="13"><output id="plateOut"></output></div>
      <h3>Rich-list news from ${esc(search)}</h3><div id="richNews"><button class="action" id="richBtn">Load the news</button></div>
    </div>
  </section>`;

  $('#closeBtn').addEventListener('click', () => { box.hidden = true; state.current = null; state.layer.setStyle(style); });
  box.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => runQuick(QUICK.find((q) => q.id === b.dataset.q), b)));

  $('#plateIn').addEventListener('input', (e) => {
    const m = e.target.value.toUpperCase().match(/^UP\s*(\d{2})/);
    $('#plateOut').textContent = !m ? (e.target.value.length > 3 ? 'Not a UP plate' : '') : RTO[Number(m[1])] ? `Registered at the ${RTO[Number(m[1])]} RTO` : 'Unknown UP code';
  });
  $('#richBtn').addEventListener('click', () => newsBlock($('#richNews'), `${search} billionaire OR crorepati OR businessman family company`));

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

  const loaders = {
    news: () => newsBlock($('#news'), `${search} Uttar Pradesh when:7d`, { pins: true }),
    lawyers: async () => {
      try {
        const list = await places(['lawyer'], 20000);
        const slot = $('#lawyers');
        slot.innerHTML = named(list).length ? placeList(list) : hasNoResults('lawyers');
        wirePlaces(slot, list);
      } catch (err) { $('#lawyers').innerHTML = failed('lawyers', err); }
      newsBlock($('#lawNews'), `${search} advocate case against MLA court`);
      redditBlock($('#lawReddit'), `lawyer advocate ${search}`);
      peopleBlock($('#lawPeople'), 'lawyer');
    },
    projects: () => newsBlock($('#projectNews'), `${search} project crore sanctioned OR completed OR inaugurated`),
    underrated: async () => {
      const slot = $('#under');
      try {
        const list = await places([ageBand()], 30000);
        const pool = named(list).sort(() => Math.random() - 0.5);
        slot.innerHTML = pool.length ? placeList(pool, 10) : hasNoResults('spots of this type');
        wirePlaces(slot, pool);
      } catch (err) { slot.innerHTML = failed('spots', err); }
      redditBlock($('#underReddit'), `underrated OR hidden OR ${AGE_WORDS[ageBand()]}`, { group: true });
    },
    origins: () => { peopleBlock($('#pActor'), 'actor'); peopleBlock($('#pNeta'), 'neta'); peopleBlock($('#pBusiness'), 'business'); },
    culture: async () => {
      peopleBlock($('#pMusic'), 'music'); peopleBlock($('#pArt'), 'art');
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
