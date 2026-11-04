import { RTO, PARTIES } from './content.js';
import { initHisaab } from './hisaab.js';
import { LEVELS, ROADS, RAILS, seasonNow, loadKohra, nextMorning, nextPeak, worstFog, peakTemp, looLevel, headline } from './kohra.js';
import { SAMAY_SPOTS, TRAIN_ROUTES, SEASON_FOOD, SMELLS, DIALECTS, KARIGAR } from './ghoomo-data.js';

const PAGES = [
  { key: 'hisaab', title: 'Mera Hisaab', line: "Where UP's money goes, with proof", colour: 'green' },
  { key: 'kohra', title: 'Kohra meter', line: 'Fog and loo risk, next 48 hours', colour: 'paper' },
  { key: 'samay', title: 'Samay slider', line: 'Drag the satellite back to 2014', colour: 'red' },
  { key: 'radio', title: 'Tune the TV', line: 'Local radio on the old set', colour: 'amber' },
  { key: 'mausam', title: 'Sirf is mausam mein', line: 'Food that exists only right now', colour: 'green' },
  { key: 'train', title: 'Bhojan by train', line: 'What to eat at which stop', colour: 'paper' },
  { key: 'naak', title: 'Naak ka naksha', line: 'UP, by smell', colour: 'black' },
  { key: 'bhasha', title: 'Bhasha slider', line: 'Same line, six ways', colour: 'yellow' },
  { key: 'karigar', title: 'Aakhri karigar', line: 'Akhadas and trades going quiet', colour: 'paper' },
  { key: 'plate', title: 'Plate bingo', line: 'Spot every UP code on the road', colour: 'amber' },
  { key: 'ajeeb', title: 'Ajeeb gaon', line: 'Yes, these are real places', colour: 'red' },
];

export function initGhoomo(ctx) {
  const { $, esc, state, store, api, dirLink, pinIcon, go, closeDossier, enterGhoomo, keepMapClear } = ctx;
  const group = () => state.ghoomoPins;
  const box = () => $('#dossier');
  let cleanup = null;

  function leave() {
    cleanup?.();
    cleanup = null;
    group()?.clearLayers();
    state.exploring = false;
    box().classList.remove('sheet');
  }

  function shell(title, body, { sheet = true, map = false } = {}) {
    const b = box();
    b.hidden = false;
    b.classList.remove('peek');
    b.classList.toggle('sheet', sheet);
    b.scrollTop = 0;
    b.innerHTML = `<button class="close" id="closeBtn" aria-label="Close">X</button>
      <header class="g-head"><button class="g-back" id="gBack" type="button">Ghoomo</button><h1>${esc(title)}</h1></header>
      <div class="g-body${sheet || map ? '' : ' no-map'}">${body}</div>`;
    $('#closeBtn').addEventListener('click', closeDossier);
    $('#gBack').addEventListener('click', () => open('hub'));
  }

  // Which entries a Wikipedia article backs, and which karigar pins are exact
  let checks = { sources: {}, pins: {} };
  const checksReady = fetch('data/ghoomo-checks.json').then((r) => r.json()).then((j) => { checks = j; }).catch(() => {});
  const proofLine = (key, q) => {
    const s = checks.sources[key];
    const news = `https://www.google.com/search?tbm=nws&q=${encodeURIComponent(q)}`;
    const reddit = `https://www.reddit.com/search/?q=${encodeURIComponent(q)}`;
    const fix = `https://github.com/faizdevx/Survive_UttarPradesh/issues/new?title=${encodeURIComponent(`Fix: ${q}`)}`;
    return `<span class="proof">${s ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">Mentioned on Wikipedia</a>` : '<b>No source found</b>'}, <a href="${news}" target="_blank" rel="noopener">news</a>, <a href="${reddit}" target="_blank" rel="noopener">Reddit</a>, <a href="${fix}" target="_blank" rel="noopener">wrong?</a></span>`;
  };
  const spot = (x) => {
    if (checks.pins[x.what]) return [checks.pins[x.what].lat, checks.pins[x.what].lng];
    if (x.lat != null && !x.what) return [x.lat, x.lng];
    if (x.what) { const d = state.districts[x.district]; return [d.lat, d.lng]; }
    if (x.lat != null) return [x.lat, x.lng];
    const d = state.districts[x.district];
    return [d.lat, d.lng];
  };
  const mapsLink = (lat, lng) => dirLink({ lat, lng });

  // Pins plus a tappable list, shared by the map-led pages
  function pinList(el, items, { label, sub, cls, proof, circle }) {
    group().clearLayers();
    const marks = items.map((x) => {
      const [lat, lng] = spot(x);
      if (circle?.(x)) L.circle([lat, lng], { radius: 6000, color: '#f6c400', weight: 2, dashArray: '5 5', fillOpacity: 0.12 }).addTo(group());
      return L.marker([lat, lng], { icon: pinIcon(cls) }).addTo(group())
        .bindPopup(`<b>${esc(label(x))}</b><br>${esc(sub(x))}<br><a href="${mapsLink(lat, lng)}" target="_blank" rel="noopener">Get directions</a>`);
    });
    el.innerHTML = `<ul class="list">${items.map((x, i) => `<li><button class="link" data-i="${i}">${esc(label(x))}</button><span class="meta">${esc(sub(x))}</span>${proof ? proof(x) : ''}</li>`).join('')}</ul>`;
    el.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => {
      const m = marks[Number(b.dataset.i)];
      state.map.flyTo(m.getLatLng(), Math.max(state.map.getZoom(), 10));
      m.openPopup();
    }));
    if (marks.length) keepMapClear(L.featureGroup(marks).getBounds());
  }

  /* Hub */
  function hub() {
    shell('Ghoomo UP', `<p class="lead g-lead">Things you will not find on a normal map. Pick one.</p>
      <div class="g-grid">${PAGES.map((p) => `<button class="g-card g-${p.colour}" data-page="${p.key}"><b>${esc(p.title)}</b><span>${esc(p.line)}</span></button>`).join('')}</div>`, { sheet: false });
    $('#gBack').hidden = true;
    box().querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => open(b.dataset.page)));
  }

  /* Samay slider */
  async function samay() {
    box().hidden = true;
    document.body.classList.add('samay-on');
    const bar = $('#samayBar');
    bar.hidden = false;
    let current = null;
    let timer = null;
    let ask = 0;
    let stops = [];
    let spotIndex = 0;
    const layers = new Set();
    // The imagery is the point here, so district shapes step aside until closing
    state.layer.remove();
    cleanup = () => {
      clearInterval(timer);
      ask += 1;
      layers.forEach((l) => l.remove());
      layers.clear();
      state.layer.addTo(state.map);
      document.body.classList.remove('samay-on');
      bar.hidden = true;
      state.map.off('moveend', moved);
    };
    const nice = (iso) => new Date(`${iso}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    bar.innerHTML = `<div class="samay-top"><b id="samayDate">Reading photo dates…</b><button id="samayClose" class="close-mini" aria-label="Close Samay slider">X</button></div>
      <p class="samay-small" id="samayWhat"></p>
      <input id="samayRange" type="range" min="0" max="0" value="0" aria-label="Choose a photo">
      <div class="samay-row"><button id="samayPlay" type="button">Play</button><span class="samay-note" id="samayNote"></span></div>
      <div class="samay-spots">${SAMAY_SPOTS.map((s, i) => `<button data-spot="${i}" type="button">${esc(s.name)}</button>`).join('')}<button id="samayHere" type="button">Photos of this view</button></div>`;
    $('#samayClose').addEventListener('click', closeDossier);
    const range = $('#samayRange');
    const show = (i) => {
      const s = stops[i];
      if (!s) return;
      $('#samayDate').textContent = s.photo ? `Photo taken ${nice(s.photo)}` : `Archived ${nice(s.archived)}`;
      const month = s.photo ? Number(s.photo.slice(5, 7)) : 0;
      const mela = SAMAY_SPOTS[spotIndex]?.mela && month >= 1 && month <= 2;
      $('#samayWhat').textContent = s.photo
        ? `Photo ${i + 1} of ${stops.length} of this spot${s.sat ? `, ${s.sat} satellite` : ''}${s.res ? `, ${Math.round(s.res * 100)} cm detail` : ''}.${mela ? ' Taken in January or February, when melas run, so look for tents on the sand.' : ''}`
        : 'Esri has no photo date for this spot, so this shows when it was archived. The photo can be older.';
      const mine = (ask += 1);
      const next = L.tileLayer(`https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${s.id}/{z}/{y}/{x}`, { maxNativeZoom: 17, maxZoom: 19, attribution: 'Archive Esri Wayback' });
      layers.add(next);
      // The old photo stays on screen until the new one has drawn, so dragging never flashes blank
      next.once('load', () => {
        const drop = (l) => { layers.delete(l); setTimeout(() => l.remove(), 0); };
        if (mine !== ask) { drop(next); return; }
        if (current && current !== next) drop(current);
        current = next;
      });
      next.addTo(state.map);
    };
    const stop = () => { clearInterval(timer); timer = null; $('#samayPlay').textContent = 'Play'; };
    // The six spots are saved. Any other view is read live, which takes a while.
    const saved = fetch('data/samay-spots.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
    async function loadDates(lat, lng, name) {
      stop();
      const mine = (ask += 1);
      $('#samayDate').textContent = 'Reading photo dates…';
      $('#samayWhat').textContent = name ? '' : 'Asking the archive about this exact spot. This can take up to 2 minutes the first time.';
      try {
        const r = (name && (await saved)?.spots[name]) || await api('samayhere', { lat: lat.toFixed(2), lng: lng.toFixed(2) });
        if (mine !== ask || !document.body.classList.contains('samay-on')) return;
        stops = r.stops;
        range.max = Math.max(0, stops.length - 1);
        range.value = 0;
        show(0);
      } catch (err) {
        if (mine === ask) $('#samayDate').textContent = 'Could not read the archive';
        $('#samayWhat').textContent = err.message;
      }
    }
    range.addEventListener('input', () => show(Number(range.value)));
    $('#samayPlay').addEventListener('click', () => {
      if (timer) return stop();
      if (Number(range.value) >= stops.length - 1) range.value = 0;
      $('#samayPlay').textContent = 'Pause';
      show(Number(range.value));
      timer = setInterval(() => {
        const n = Number(range.value) + 1;
        if (n >= stops.length) return stop();
        range.value = n;
        show(n);
      }, 2200);
    });
    function moved() { $('#samayHere').classList.add('samay-new'); }
    const goSpot = (i, jump) => {
      const s = SAMAY_SPOTS[i];
      spotIndex = i;
      if (jump) state.map.setView([s.lat, s.lng], s.zoom, { animate: false });
      else state.map.flyTo([s.lat, s.lng], s.zoom);
      $('#samayNote').textContent = s.note;
      bar.querySelectorAll('[data-spot]').forEach((b) => b.setAttribute('aria-pressed', Number(b.dataset.spot) === i));
      loadDates(s.lat, s.lng, s.name);
    };
    bar.querySelectorAll('[data-spot]').forEach((b) => b.addEventListener('click', () => goSpot(Number(b.dataset.spot))));
    $('#samayHere').addEventListener('click', () => {
      const c = state.map.getCenter();
      spotIndex = -1;
      $('#samayNote').textContent = 'Photos of wherever the map is now.';
      bar.querySelectorAll('[data-spot]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      $('#samayHere').classList.remove('samay-new');
      loadDates(c.lat, c.lng);
    });
    goSpot(0, true);
    state.map.on('moveend', moved);
  }

  /* Tune the TV */
  const audio = new Audio();
  audio.preload = 'none';
  let airing = null;
  const stopRadio = () => {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    airing = null;
    $('#radioBar').hidden = true;
  };
  $('#radioStop').addEventListener('click', () => { stopRadio(); $('#tvPlay')?.replaceChildren('Play'); });

  async function radio() {
    shell('Tune the TV', `<div class="mini-tv" id="miniTv"><span id="tvBand">Warming up</span><b id="tvName">Loading stations…</b><span id="tvStatus"></span></div>
      <div class="tv-dial"><button id="tvPrev" type="button" aria-label="Previous station">Prev</button><button id="tvPlay" type="button">Play</button><button id="tvNext" type="button" aria-label="Next station">Next</button></div>
      <input id="tvRange" type="range" min="0" max="0" value="0" aria-label="Radio dial">
      <div id="tvList"></div>
      <p class="muted g-pad" id="tvNote">From the community-run Radio Browser list. Every station here answered a live check within the last 30 minutes, and dead ones are removed. "Listed as UP" is what whoever added the station typed, so it may not be local. Few UP stations stream online. Akashvani's UP stations are not in this list.</p>`, { sheet: false });
    let list;
    try { list = await api('radio', {}); } catch (err) {
      $('#tvName').textContent = 'Could not load stations';
      $('#tvStatus').textContent = err.message;
      return;
    }
    if (!$('#tvRange')) return;
    if (!list.length) { $('#tvName').textContent = 'No stations right now'; return; }
    const range = $('#tvRange');
    range.max = list.length - 1;
    let at = Math.max(0, list.findIndex((s) => s.url === airing?.url));
    let skips = 0;
    const flick = () => {
      const tv = $('#miniTv');
      tv?.classList.remove('flick');
      void tv?.offsetWidth;
      tv?.classList.add('flick');
    };
    const paint = () => {
      const s = list[at];
      $('#tvBand').textContent = s.band;
      $('#tvName').textContent = s.name;
      range.value = at;
      document.querySelectorAll('#tvList [data-st]').forEach((b) => b.setAttribute('aria-pressed', Number(b.dataset.st) === at));
    };
    const play = () => {
      const s = list[at];
      airing = s;
      audio.src = s.url;
      $('#tvStatus').textContent = 'Tuning…';
      $('#radioName').textContent = s.name;
      $('#radioBar').hidden = false;
      audio.play().then(() => { skips = 0; }).catch(() => {});
      $('#tvPlay').textContent = 'Stop';
    };
    const tune = (i, start = Boolean(airing)) => {
      at = (i + list.length) % list.length;
      flick();
      paint();
      if (start) play();
    };
    audio.onplaying = () => { const el = $('#tvStatus'); if (el) el.textContent = 'On air'; };
    audio.onerror = () => {
      if (!airing) return;
      // A dead stream moves on by itself, but never loops around the whole dial
      skips += 1;
      if (skips >= list.length || !$('#tvRange')) {
        stopRadio();
        const el = $('#tvStatus');
        if (el) el.textContent = 'No station answered.';
        return;
      }
      const el = $('#tvStatus');
      if (el) el.textContent = `${list[at].name} is off air, moving on`;
      tune(at + 1, true);
    };
    $('#tvList').innerHTML = `<div class="tv-chips">${list.map((s, i) => `<button data-st="${i}" type="button">${esc(s.name)}</button>`).join('')}</div>`;
    document.querySelectorAll('#tvList [data-st]').forEach((b) => b.addEventListener('click', () => tune(Number(b.dataset.st), true)));
    $('#tvPrev').addEventListener('click', () => tune(at - 1));
    $('#tvNext').addEventListener('click', () => tune(at + 1));
    range.addEventListener('input', () => tune(Number(range.value)));
    $('#tvPlay').addEventListener('click', () => {
      if (airing) { stopRadio(); $('#tvPlay').textContent = 'Play'; $('#tvStatus').textContent = ''; } else play();
    });
    if (airing) { $('#tvPlay').textContent = 'Stop'; $('#tvStatus').textContent = 'On air'; }
    paint();
  }

  /* Sirf is mausam mein */
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  async function mausam() {
    const now = new Date().getMonth() + 1;
    shell('Sirf is mausam mein', `<div class="g-pad"><label class="g-label" for="monthRange">Month: <b id="monthName"></b></label>
      <input id="monthRange" type="range" min="1" max="12" value="${now}"></div><div id="monthList" class="g-pad"></div>
      <p class="muted g-pad">Hand-collected and approximate. "Mentioned on Wikipedia" means an article names both the food and the place, and it may not confirm the season. Ask before you travel for it.</p>`);
    const render = () => {
      const m = Number($('#monthRange').value);
      $('#monthName').textContent = `${MONTHS[m - 1]}${m === now ? ', right now' : ''}`;
      const items = SEASON_FOOD.filter((x) => x.months.includes(m));
      const el = $('#monthList');
      if (!items.length) { group().clearLayers(); el.innerHTML = '<p class="empty">Nothing here is special to this month. Try the next one.</p>'; return; }
      pinList(el, items, { label: (x) => x.food, sub: (x) => `${state.districts[x.district].city.en || x.district}. ${x.note}`, proof: (x) => proofLine(`food:${x.food}`, `${x.food} ${state.districts[x.district].city.en || x.district}`) });
    };
    await checksReady;
    $('#monthRange').addEventListener('input', render);
    render();
  }

  /* Bhojan by train */
  async function train() {
    shell('Bhojan by train', `<div class="g-pad"><label class="g-label" for="routePick">Your line</label>
      <select id="routePick" class="g-select">${TRAIN_ROUTES.map((r, i) => `<option value="${i}">${esc(r.name)}</option>`).join('')}</select></div>
      <div id="routeStops" class="g-pad"></div>
      <p class="muted g-pad">Hand-collected and not train-specific. Check your train stops there, and that the food is sold on the platform and not only in town.</p>`);
    await checksReady;
    let line = null;
    cleanup = () => line?.remove();
    const render = () => {
      const route = TRAIN_ROUTES[Number($('#routePick').value)];
      pinList($('#routeStops'), route.stops, { label: (s) => `${s.town}: ${s.food}`, sub: (s) => s.note, proof: (s) => proofLine(`train:${s.town}:${s.food}`, `${s.food.split(',')[0]} ${s.town}`) });
      line?.remove();
      line = L.polyline(route.stops.map(spot), { color: '#f6c400', weight: 3, dashArray: '8 7' }).addTo(group());
    };
    $('#routePick').addEventListener('change', render);
    render();
  }

  /* Naak ka naksha */
  async function naak() {
    shell('Naak ka naksha', `<p class="lead g-lead">UP by smell. Tap a nose and follow it.</p><div id="noseList" class="g-pad"></div>
      <p class="muted g-pad">Hand-collected. Some are lovely. Some are not.</p>`);
    await checksReady;
    pinList($('#noseList'), SMELLS, { label: (x) => x.smell, sub: (x) => `${state.districts[x.district].city.en || x.district}. ${x.note}`, cls: 'nose', proof: (x) => proofLine(`smell:${x.smell}`, `${x.smell} ${state.districts[x.district].city.en || x.district}`) });
  }

  /* Bhasha slider */
  function bhasha() {
    const zoneOf = {};
    DIALECTS.forEach((z, i) => z.districts.forEach((d) => { zoneOf[d] = i; }));
    let at = 0;
    let line = 0;
    shell('Bhasha slider', `<div class="g-pad"><label class="g-label" for="zoneRange">West to east</label>
      <input id="zoneRange" type="range" min="0" max="${DIALECTS.length - 1}" value="0">
      <div class="tags" id="lineTabs"><button data-line="0" aria-pressed="true"><span>Where are you going?</span></button><button data-line="1" aria-pressed="false"><span>What are you doing?</span></button></div>
      <div class="zone-card" id="zoneCard"></div>
      <div class="row-btns" id="zoneLinks"></div>
      <p class="muted">Rough spellings, not yet checked by native speakers, and these zones blur into each other. A wrong line beats a confident one only if you fix it, so please tell us.</p></div>`);
    const render = () => {
      const z = DIALECTS[at];
      $('#zoneCard').innerHTML = `<span>${esc(z.name)}, ${esc(z.where)}</span><b lang="hi">${esc(z.lines[line][0])}</b><i>${esc(z.lines[line][1])}</i>`;
      $('#zoneCard').style.borderColor = z.color;
      const fix = `https://github.com/faizdevx/Survive_UttarPradesh/issues/new?title=${encodeURIComponent(`Dialect fix: ${z.name}`)}&body=${encodeURIComponent(`Line shown: ${z.lines[line][0]}\nHow we really say it:\nWhere I am from:`)}`;
      $('#zoneLinks').innerHTML = `<a class="action" href="https://www.youtube.com/results?search_query=${encodeURIComponent(`${z.name} language conversation`)}" target="_blank" rel="noopener">Hear real speakers</a>
        <a class="action ghost" href="https://en.wikipedia.org/wiki/${encodeURIComponent(z.wiki)}" target="_blank" rel="noopener">About ${esc(z.name)}</a>
        <a class="action ghost" href="${fix}" target="_blank" rel="noopener">Say it's wrong</a>`;
      state.layer.setStyle(ctx.style);
    };
    state.overlay = {
      fill: (name) => DIALECTS[zoneOf[name]]?.color || '#777',
      strong: (name) => zoneOf[name] === at,
      tip: (name) => `<b>${esc(name)}</b>${esc(DIALECTS[zoneOf[name]]?.name || '')}`,
      click: (name) => { if (zoneOf[name] != null) { at = zoneOf[name]; $('#zoneRange').value = at; render(); } },
    };
    cleanup = () => {
      state.overlay = null;
      state.layer.setStyle(ctx.style);
    };
    $('#zoneRange').addEventListener('input', (e) => { at = Number(e.target.value); render(); });
    box().querySelectorAll('[data-line]').forEach((b) => b.addEventListener('click', () => {
      line = Number(b.dataset.line);
      box().querySelectorAll('[data-line]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      render();
    }));
    keepMapClear(state.layer.getBounds());
    render();
  }

  /* Aakhri karigar */
  async function karigar() {
    const kinds = ['All', ...new Set(KARIGAR.map((k) => k.kind))];
    shell('Aakhri karigar', `<div class="g-pad"><p class="lead">Hard to find on purpose: go, ask around, buy something. Public places and trades only.</p>
      <div class="tags" id="kindTabs">${kinds.map((k, i) => `<button data-kind="${esc(k)}" aria-pressed="${i === 0}"><span>${esc(k)}</span></button>`).join('')}</div>
      <div id="kList"></div><p class="muted">Hand-collected, and nobody has walked these yet. A pin marks the named locality from GeoNames, not a door. Gone and found it, or found it gone? Tell us with "wrong?".</p></div>`);
    const render = (kind) => {
      box().querySelectorAll('[data-kind]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.kind === kind));
      pinList($('#kList'), KARIGAR.filter((k) => kind === 'All' || k.kind === kind), {
        label: (k) => k.what,
        sub: (k) => `${checks.pins[k.what] ? `Pin on ${checks.pins[k.what].place}` : 'Dashed ring: somewhere around here'}, ${k.district}. ${k.note}`,
        circle: (k) => !checks.pins[k.what],
        proof: (k) => `${proofLine(`karigar:${k.what}`, `${k.what} ${k.district}`)}<a class="proof" href="https://www.google.com/maps/search/${encodeURIComponent(`${k.what} near ${k.place} ${k.district}`)}" target="_blank" rel="noopener">Find on Google Maps</a>`,
      });
    };
    await checksReady;
    box().querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => render(b.dataset.kind)));
    render('All');
  }

  /* Plate bingo */
  const RANKS = [[0, 'Gaadi mein baitho'], [5, 'Road trip shuru'], [15, 'Dhaba regular'], [30, 'Truck driver level'], [50, 'Expressway expert'], [70, 'UP ka raja']];
  function plate() {
    const codes = Object.keys(RTO).map(Number).sort((a, b) => a - b);
    const load = () => { try { return new Set(JSON.parse(store.get('plates') || '[]')); } catch { return new Set(); } };
    const seen = load();
    const save = () => store.set('plates', JSON.stringify([...seen]));
    shell('Plate bingo', `<div class="g-pad"><p class="lead">Spot a UP plate on the road, tap its code. Fills up across your trips, in this browser only. No owners, just where it was registered.</p>
      <div class="bingo-score"><b id="bingoCount"></b><span id="bingoRank"></span></div>
      <div class="bingo-bar"><i id="bingoFill"></i></div>
      <div class="bingo">${codes.map((c) => `<button data-code="${c}" aria-pressed="${seen.has(c)}" title="${esc(RTO[c])}"><b>UP${c}</b><span>${esc(RTO[c])}</span></button>`).join('')}</div>
      <div class="row-btns"><button class="action" id="bingoShare" type="button">Share my score</button><button class="action ghost" id="bingoReset" type="button">Start over</button></div>
      <p id="bingoMsg" class="muted" role="status"></p></div>`, { sheet: false });
    const paint = () => {
      $('#bingoCount').textContent = `${seen.size} of ${codes.length}`;
      $('#bingoRank').textContent = [...RANKS].reverse().find(([n]) => seen.size >= n)[1];
      $('#bingoFill').style.width = `${(100 * seen.size) / codes.length}%`;
    };
    box().querySelectorAll('[data-code]').forEach((b) => b.addEventListener('click', () => {
      const c = Number(b.dataset.code);
      if (seen.has(c)) seen.delete(c); else seen.add(c);
      b.setAttribute('aria-pressed', seen.has(c));
      save();
      paint();
    }));
    $('#bingoShare').addEventListener('click', async () => {
      const text = `I have spotted ${seen.size} of ${codes.length} UP number plate codes on Survive Uttar Pradesh.`;
      const msg = $('#bingoMsg');
      try {
        if (navigator.share) { await navigator.share({ text }); return; }
        await navigator.clipboard.writeText(text);
        msg.textContent = 'Copied. Paste it wherever.';
      } catch (err) { if (err.name !== 'AbortError') msg.textContent = text; }
    });
    $('#bingoReset').addEventListener('click', () => {
      if (!seen.size || !confirm('Clear all your spotted plates?')) return;
      seen.clear();
      save();
      box().querySelectorAll('[data-code]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      paint();
    });
    paint();
  }

  /* Ajeeb gaon */
  async function ajeeb() {
    shell('Ajeeb gaon', '<p class="lead g-lead">Every name below is in the GeoNames place list for UP. People live here, so we laugh at the name and not at them. Meanings are our own reading of the word, and a place name may come from something else entirely.</p><div id="ajList" class="g-pad">Loading…</div>');
    try {
      const list = await (await fetch('data/ajeeb.json')).json();
      if ($('#ajList')) pinList($('#ajList'), list, { label: (x) => x.name, sub: (x) => `${x.note}${x.copies > 1 ? ` UP has ${x.copies} places with this name, and this is the biggest.` : ''}` });
    } catch (err) { $('#ajList').innerHTML = `<p class="empty">Could not load the list: ${esc(err.message)}.</p>`; }
  }

  /* Kohra meter */
  async function kohra() {
    shell('Kohra meter', '<div class="g-pad" id="kBody">Checking the next 48 hours…</div>');
    let data;
    try { data = await loadKohra(); } catch (err) {
      const el = $('#kBody');
      if (el) el.innerHTML = `<p class="empty">Could not load the forecast: ${esc(err.message)}. Try again in a minute. For official warnings see <a href="https://mausam.imd.gov.in/" target="_blank" rel="noopener">IMD</a>.</p>`;
      return;
    }
    if (!$('#kBody')) return;
    let mode = seasonNow();
    let at = 0;
    let picked = null;
    let lines = [];
    let seen = [];
    const roads = await fetch('data/roads.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const clock = (iso) => new Date(`${iso}:00+05:30`).toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', hour12: true, timeZone: 'Asia/Kolkata' });
    const levelAt = (name, i) => (mode === 'kohra' ? Number(data.d[name].f[i]) : looLevel(data.d[name].t[i]));
    const window = () => (mode === 'kohra' ? nextMorning(data) : nextPeak(data));
    const worstOn = (name) => {
      const { idx } = window();
      return mode === 'kohra' ? worstFog(data, name, idx) : looLevel(peakTemp(data, name, idx));
    };
    const fiveAm = () => {
      const i = data.hours.findIndex((t) => t.slice(11, 13) === '05');
      return i < 0 ? 0 : i;
    };
    const twoPm = () => {
      const i = data.hours.findIndex((t) => t.slice(11, 13) === '14');
      return i < 0 ? 0 : i;
    };
    at = mode === 'kohra' ? fiveAm() : twoPm();

    $('#kBody').innerHTML = `<div class="tags"><button data-mode="kohra"><span>Kohra</span></button><button data-mode="loo"><span>Loo</span></button></div>
      <p class="k-head" id="kHead"></p>
      <div class="k-when"><span id="kWhen"></span><button id="kJump" type="button"></button></div>
      <input id="kRange" type="range" min="0" max="${data.hours.length - 1}" value="${at}" aria-label="Forecast hour">
      <div class="k-legend" id="kLegend"></div>
      <div id="kSeen"></div>
      <div id="kPick"><p class="muted">Tap a district on the map for its hour-by-hour risk.</p></div>
      <div id="kLines"></div>
      <div id="kNews"></div>
      <div id="kTips"></div>
      <div id="kCheck"></div>
      <p class="muted">This is a risk estimate from a weather model, using visibility, humidity, dew point and wind. It has not been checked against real fog records, and fog forms in patches a model cannot see. Never treat low risk as safe. Official warnings: <a href="https://mausam.imd.gov.in/" target="_blank" rel="noopener">IMD</a>. Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>. Routes are drawn through district towns, so they are rough.</p>`;

    const paintMap = () => {
      state.overlay = {
        fill: (name) => LEVELS[mode][levelAt(name, at)].color,
        strong: () => true,
        tip: (name) => {
          const d = data.d[name];
          return `<b>${esc(name)}</b>${esc(LEVELS[mode][levelAt(name, at)].label)}<br>${mode === 'kohra' ? `Model visibility ${d.v[at]} km` : `${d.t[at]}°C, feels like ${d.a[at]}°C`}`;
        },
        click: (name) => { picked = name; paintPick(); },
      };
      state.layer.setStyle(ctx.style);
    };

    function paintPick() {
      if (!picked) return;
      const d = data.d[picked];
      const bars = data.hours.map((_, i) => {
        const lv = levelAt(picked, i);
        return `<i style="height:${25 + lv * 25}%;background:${LEVELS[mode][lv].color};outline:${i === at ? '2px solid #000' : '0'}" title="${esc(clock(data.hours[i]))}"></i>`;
      }).join('');
      $('#kPick').innerHTML = `<div class="k-card"><h3>${esc(picked)}</h3>
        <b>${esc(LEVELS[mode][levelAt(picked, at)].label)}</b> at ${esc(clock(data.hours[at]))}. ${mode === 'kohra' ? `Model visibility ${d.v[at]} km.` : `${d.t[at]}°C, feels like ${d.a[at]}°C.`}
        <div class="k-strip" role="img" aria-label="Risk for each of the next 48 hours">${bars}</div>
        <div class="k-axis"><span>${esc(clock(data.hours[0]))}</span><span>${esc(clock(data.hours[data.hours.length - 1]))}</span></div>
        <button class="link-btn" id="kCity" type="button">Open ${esc(picked)}</button></div>`;
      $('#kCity').addEventListener('click', () => { const n = picked; closeDossier(); ctx.openCity(n); });
    }

    // A road shows how much of it is at risk, so one foggy district does not paint the whole line
    const seenFog = (names) => seen.filter((s) => s.fresh && s.metres < 1000 && names.includes(s.district));
    function lineRow(l, i, kind) {
      const real = kind === 'road' ? roads?.roads?.[l.name] : null;
      const names = real ? Object.keys(real.districts).filter((n) => data.d[n]) : l.districts;
      const worst = names.reduce((best, n) => (worstOn(n) > worstOn(best) ? n : best), names[0]);
      const lv = worstOn(worst);
      const risky = names.filter((n) => worstOn(n) >= 2);
      const say = kind === 'road' ? LEVELS.kohra[lv].road : LEVELS.kohra[lv].rail;
      const share = real
        ? `${risky.reduce((a, n) => a + real.districts[n], 0)} of ${names.reduce((a, n) => a + real.districts[n], 0)} km runs through fog-risk districts.`
        : `${risky.length} of ${names.length} districts on this line at fog risk.`;
      const now = seenFog(names);
      return `<div class="k-row"><i style="background:${LEVELS.kohra[lv].color}"></i><button data-line="${kind}-${i}">${esc(l.name)}</button>
        <span>${esc(say)} ${esc(share)}${lv ? ` Worst near ${esc(worst)}.` : ''}${now.length ? ` <b>Fog reported now at ${esc(now.map((s) => s.district).join(', '))} airport.</b>` : ''}</span></div>`;
    }
    function paintLines() {
      lines.forEach((l) => l.remove());
      lines = [];
      if (mode !== 'kohra') {
        const { idx, word } = nextPeak(data);
        const hot = Object.keys(data.d).sort((a, b) => peakTemp(data, b, idx) - peakTemp(data, a, idx)).slice(0, 5);
        $('#kLines').innerHTML = `<h3>Hottest districts, ${esc(word.toLowerCase())}</h3>${hot.map((n) => { const t = peakTemp(data, n, idx); return `<div class="k-row"><i style="background:${LEVELS.loo[looLevel(t)].color}"></i><button data-hot="${esc(n)}">${esc(n)}</button><span>${t}°C at its peak</span></div>`; }).join('')}`;
        $('#kLines').querySelectorAll('[data-hot]').forEach((b) => b.addEventListener('click', () => { picked = b.dataset.hot; paintPick(); }));
        $('#kTips').innerHTML = `<h3>Surviving loo</h3><ul class="k-tips"><li>Stay out of direct sun from noon to 4 PM.</li><li>Drink water before you feel thirsty. Aam panna counts.</li><li>Cover your head, and carry water on a bike.</li><li>Confusion, hot dry skin or fainting is an emergency: call 108.</li></ul>`;
        return;
      }
      const { word } = nextMorning(data);
      $('#kLines').innerHTML = `<h3>Expressways, ${esc(word.toLowerCase())}</h3>${ROADS.map((l, i) => lineRow(l, i, 'road')).join('')}
        <h3>Train lines, ${esc(word.toLowerCase())}</h3>${RAILS.map((l, i) => lineRow(l, i, 'rail')).join('')}
        <p class="muted">This is fog risk along the line, not your train's status. No free live delay feed exists that we can use. <a href="https://enquiry.indianrail.gov.in/mntes/" target="_blank" rel="noopener">NTES has the real running status for your train</a>.</p>${roads?.roads ? '' : '<p class="muted">Road lengths are not available right now, so roads are counted by district and drawn as dashed lines between towns.</p>'}`;
      $('#kLines').querySelectorAll('[data-line]').forEach((b) => b.addEventListener('click', () => {
        const [kind, i] = b.dataset.line.split('-');
        const route = (kind === 'road' ? ROADS : RAILS)[Number(i)];
        lines.forEach((l) => l.remove());
        const real = kind === 'road' ? roads?.roads?.[route.name] : null;
        const shape = L.polyline(real ? real.lines : route.districts.map((n) => [state.districts[n].lat, state.districts[n].lng]), { color: '#000', weight: 5, dashArray: real ? null : '8 7' }).addTo(group());
        lines = [shape];
        keepMapClear(shape.getBounds());
      }));
      $('#kTips').innerHTML = `<h3>If you must drive in fog</h3><ul class="k-tips"><li>Low beam only. High beam bounces back and blinds you.</li><li>Slow right down and leave a long gap. Pile-ups start with one sudden stop.</li><li>Never stop on the carriageway. Pull fully off the road first.</li><li>Stuck on a highway? Call 1033 for NHAI, or 112.</li></ul>`;
    }

    const paintWhen = () => {
      $('#kWhen').textContent = clock(data.hours[at]);
    };
    const paintMode = () => {
      box().querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === mode));
      $('#kHead').textContent = headline(data, mode);
      $('#kJump').textContent = mode === 'kohra' ? 'Go to 5 AM' : 'Go to 2 PM';
      $('#kLegend').innerHTML = LEVELS[mode].map((l) => `<span><i style="background:${l.color}"></i>${esc(l.label)}</span>`).join('');
      paintWhen();
      paintMap();
      paintLines();
      paintPick();
    };
    const setHour = (i) => {
      at = i;
      $('#kRange').value = i;
      paintWhen();
      paintMap();
      paintPick();
    };
    $('#kRange').addEventListener('input', (e) => setHour(Number(e.target.value)));
    $('#kJump').addEventListener('click', () => setHour(mode === 'kohra' ? fiveAm() : twoPm()));
    box().querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
      mode = b.dataset.mode;
      at = mode === 'kohra' ? fiveAm() : twoPm();
      $('#kRange').value = at;
      paintMode();
    }));
    cleanup = () => {
      state.overlay = null;
      lines.forEach((l) => l.remove());
      state.layer.setStyle(ctx.style);
    };
    keepMapClear(state.layer.getBounds());
    paintMode();

    // Real readings from the ground
    api('kohraobs', {}).then((o) => {
      const slot = $('#kSeen');
      if (!slot) return;
      const when = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
      seen = o.stations.map((s) => ({ ...s, fresh: Date.now() - Date.parse(s.at) < 3 * 3600000 }));
      const word = (m) => (m < 200 ? 'dense fog' : m < 500 ? 'fog' : m < 1000 ? 'light fog' : m < 3000 ? 'mist or haze' : 'clear enough');
      slot.innerHTML = `<h3>Seen right now, at airports</h3>${seen.map((s) => `<div class="k-row"><i style="background:${LEVELS.kohra[s.metres < 200 ? 3 : s.metres < 500 ? 2 : s.metres < 1000 ? 1 : 0].color}"></i><b>${esc(s.district)}</b>: ${s.metres.toLocaleString('en-IN')} m, ${word(s.metres)}<span>Reported ${esc(when(s.at))}${s.fresh ? '' : ', so this is old'}. A real reading, for that airport only.</span></div>`).join('')}`;
      if (mode === 'kohra') paintLines();
    }).catch(() => {
      const slot = $('#kSeen');
      if (slot) slot.innerHTML = '<p class="muted">Airport readings are not available right now.</p>';
    });
    // Live reports of fog delays
    api('news', { q: '(train OR trains) late fog Uttar Pradesh when:3d' }).then((items) => {
      const slot = $('#kNews');
      if (!slot) return;
      const list = items.filter((n) => /fog|kohra|कोहरा/i.test(n.title)).slice(0, 5);
      slot.innerHTML = `<h3>Fog and trains in the news, last 3 days</h3>${list.length ? `<ul class="list">${list.map((n) => `<li><a href="${/^https?:/.test(n.url) ? esc(n.url) : '#'}" target="_blank" rel="noopener">${esc(n.title)}</a><span class="meta">${esc(n.source)}</span></li>`).join('')}</ul>` : '<p class="muted">Nothing reported lately.</p>'}`;
    }).catch(() => {});
    // What the score has really earned
    fetch('data/kohra-check.json').then((r) => r.json()).then((c) => {
      const slot = $('#kCheck');
      if (!slot) return;
      const pc = (x) => `${Math.round(x * 100)}%`;
      const names = { 1: 'Light fog or worse, under 1 km', 2: 'Fog, under 500 m', 3: 'Dense fog, under 200 m' };
      slot.innerHTML = `<h3>How good is this score?</h3>
        <p class="lead">Tested on ${c.mornings} real airport mornings at ${esc(c.stations.map((s) => s.district).join(', '))}, ${esc(c.period)}. The figures below are for January.</p>
        ${Object.entries(c.levels).map(([k, l]) => `<div class="k-row"><b>${names[k]}</b><span>Caught ${pc(l.oldRule.caught)} of mornings it happened. When it warned, it was right ${pc(l.oldRule.rightWhenWarned)} of the time.</span></div>`).join('')}
        <p class="muted">It leans towards warning, so expect false alarms, especially for dense fog. Fog was very common last winter, which makes high scores easier. This used the model's freshest run, so a forecast made a day ahead will likely do worse. Three airports are not all of UP, and it was checked on one winter. Trying other thresholds did not do better on January, so we kept these.</p>`;
    }).catch(() => {});
  }

  const renderHisaab = initHisaab(ctx);
  const hisaab = () => renderHisaab(shell, (fn) => { cleanup = fn; });
  const RUN = { hisaab, kohra, hub, samay, radio, mausam, train, naak, bhasha, karigar, plate, ajeeb };

  async function open(key = 'hub') {
    const run = RUN[key] || hub;
    await enterGhoomo();
    leave();
    state.exploring = true;
    ctx.showStatePins();
    go(`ghoomo/${key}`);
    run();
  }

  return { open, leave };
}

export { PARTIES };
