import { RTO, PARTIES } from './content.js';
import { SAMAY_SPOTS, TRAIN_ROUTES, SEASON_FOOD, SMELLS, DIALECTS, KARIGAR } from './ghoomo-data.js';

const PAGES = [
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

  function shell(title, body, { sheet = true } = {}) {
    const b = box();
    b.hidden = false;
    b.classList.remove('peek');
    b.classList.toggle('sheet', sheet);
    b.scrollTop = 0;
    b.innerHTML = `<button class="close" id="closeBtn" aria-label="Close">X</button>
      <header class="g-head"><button class="g-back" id="gBack" type="button">Ghoomo</button><h1>${esc(title)}</h1></header>
      <div class="g-body${sheet ? '' : ' no-map'}">${body}</div>`;
    $('#closeBtn').addEventListener('click', closeDossier);
    $('#gBack').addEventListener('click', () => open('hub'));
  }

  const spot = (x) => {
    if (x.lat != null) return [x.lat, x.lng];
    const d = state.districts[x.district];
    return [d.lat, d.lng];
  };
  const mapsLink = (lat, lng) => dirLink({ lat, lng });

  // Pins plus a tappable list, shared by the map-led pages
  function pinList(el, items, { label, sub, cls }) {
    group().clearLayers();
    const marks = items.map((x) => {
      const [lat, lng] = spot(x);
      return L.marker([lat, lng], { icon: pinIcon(cls) }).addTo(group())
        .bindPopup(`<b>${esc(label(x))}</b><br>${esc(sub(x))}<br><a href="${mapsLink(lat, lng)}" target="_blank" rel="noopener">Get directions</a>`);
    });
    el.innerHTML = `<ul class="list">${items.map((x, i) => `<li><button class="link" data-i="${i}">${esc(label(x))}</button><span class="meta">${esc(sub(x))}</span></li>`).join('')}</ul>`;
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
    bar.innerHTML = '<div class="samay-top"><b>Samay slider</b><button id="samayClose" class="close-mini" aria-label="Close Samay slider">X</button></div><p class="samay-note">Opening the archive…</p>';
    $('#samayClose').addEventListener('click', closeDossier);
    let current = null;
    let timer = null;
    let ask = 0;
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
    };
    let stops;
    try { stops = await api('wayback', {}); } catch (err) {
      bar.querySelector('.samay-note').textContent = `Could not open the archive: ${err.message}. Try again in a minute.`;
      return;
    }
    if (!document.body.classList.contains('samay-on')) return;
    const fmt = (iso) => new Date(iso).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    bar.innerHTML = `<div class="samay-top"><b id="samayDate"></b><button id="samayClose" class="close-mini" aria-label="Close Samay slider">X</button></div>
      <input id="samayRange" type="range" min="0" max="${stops.length - 1}" value="0" aria-label="Archive date">
      <div class="samay-row"><button id="samayPlay" type="button">Play</button><span class="samay-note" id="samayNote"></span></div>
      <div class="samay-spots">${SAMAY_SPOTS.map((s, i) => `<button data-spot="${i}" type="button">${esc(s.name)}</button>`).join('')}</div>
      <p class="samay-small">Dates are when Esri archived the map. The photo itself can be older, and some dates look the same.</p>`;
    $('#samayClose').addEventListener('click', closeDossier);
    const show = (i) => {
      const s = stops[i];
      $('#samayDate').textContent = fmt(s.date);
      const mine = (ask += 1);
      const next = L.tileLayer(`https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${s.id}/{z}/{y}/{x}`, { maxNativeZoom: 17, maxZoom: 19, attribution: 'Archive Esri Wayback' });
      // The old date stays on screen until the new one has drawn, so dragging never flashes blank
      layers.add(next);
      next.once('load', () => {
        const drop = (l) => { layers.delete(l); setTimeout(() => l.remove(), 0); };
        if (mine !== ask) { drop(next); return; }
        if (current && current !== next) drop(current);
        current = next;
      });
      next.addTo(state.map);
    };
    const range = $('#samayRange');
    range.addEventListener('input', () => show(Number(range.value)));
    const stop = () => { clearInterval(timer); timer = null; $('#samayPlay').textContent = 'Play'; };
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
      }, 1800);
    });
    const goSpot = (i, jump) => {
      const s = SAMAY_SPOTS[i];
      if (jump) state.map.setView([s.lat, s.lng], s.zoom, { animate: false });
      else state.map.flyTo([s.lat, s.lng], s.zoom);
      $('#samayNote').textContent = s.note;
      bar.querySelectorAll('[data-spot]').forEach((b) => b.setAttribute('aria-pressed', Number(b.dataset.spot) === i));
    };
    bar.querySelectorAll('[data-spot]').forEach((b) => b.addEventListener('click', () => goSpot(Number(b.dataset.spot))));
    goSpot(0, true);
    show(0);
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
      <p class="muted g-pad">From the community-run Radio Browser list. Few UP stations stream online, so most of this dial is national. Stations can go off air without warning.</p>`, { sheet: false });
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
  function mausam() {
    const now = new Date().getMonth() + 1;
    shell('Sirf is mausam mein', `<div class="g-pad"><label class="g-label" for="monthRange">Month: <b id="monthName"></b></label>
      <input id="monthRange" type="range" min="1" max="12" value="${now}"></div><div id="monthList" class="g-pad"></div>
      <p class="muted g-pad">Hand-collected and approximate. Seasons shift, so ask before you travel for it.</p>`);
    const render = () => {
      const m = Number($('#monthRange').value);
      $('#monthName').textContent = `${MONTHS[m - 1]}${m === now ? ', right now' : ''}`;
      const items = SEASON_FOOD.filter((x) => x.months.includes(m));
      const el = $('#monthList');
      if (!items.length) { group().clearLayers(); el.innerHTML = '<p class="empty">Nothing here is special to this month. Try the next one.</p>'; return; }
      pinList(el, items, { label: (x) => x.food, sub: (x) => `${state.districts[x.district].city.en || x.district}. ${x.note}` });
    };
    $('#monthRange').addEventListener('input', render);
    render();
  }

  /* Bhojan by train */
  function train() {
    shell('Bhojan by train', `<div class="g-pad"><label class="g-label" for="routePick">Your line</label>
      <select id="routePick" class="g-select">${TRAIN_ROUTES.map((r, i) => `<option value="${i}">${esc(r.name)}</option>`).join('')}</select></div>
      <div id="routeStops" class="g-pad"></div>
      <p class="muted g-pad">Hand-collected and not train-specific. Check your train stops there, and that the food is sold on the platform and not only in town.</p>`);
    let line = null;
    cleanup = () => line?.remove();
    const render = () => {
      const route = TRAIN_ROUTES[Number($('#routePick').value)];
      pinList($('#routeStops'), route.stops, { label: (s) => `${s.town}: ${s.food}`, sub: (s) => s.note });
      line?.remove();
      line = L.polyline(route.stops.map(spot), { color: '#f6c400', weight: 3, dashArray: '8 7' }).addTo(group());
    };
    $('#routePick').addEventListener('change', render);
    render();
  }

  /* Naak ka naksha */
  function naak() {
    shell('Naak ka naksha', `<p class="lead g-lead">UP by smell. Tap a nose and follow it.</p><div id="noseList" class="g-pad"></div>
      <p class="muted g-pad">Hand-collected. Some are lovely. Some are not.</p>`);
    pinList($('#noseList'), SMELLS, { label: (x) => x.smell, sub: (x) => `${state.districts[x.district].city.en || x.district}. ${x.note}`, cls: 'nose' });
  }

  /* Bhasha slider */
  function bhasha() {
    const zoneOf = {};
    DIALECTS.forEach((z, i) => z.districts.forEach((d) => { zoneOf[d] = i; }));
    let at = 0;
    let line = 0;
    const speak = (text) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'hi-IN';
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    };
    const canSpeak = 'speechSynthesis' in window;
    shell('Bhasha slider', `<div class="g-pad"><label class="g-label" for="zoneRange">West to east</label>
      <input id="zoneRange" type="range" min="0" max="${DIALECTS.length - 1}" value="0">
      <div class="tags" id="lineTabs"><button data-line="0" aria-pressed="true"><span>Where are you going?</span></button><button data-line="1" aria-pressed="false"><span>What are you doing?</span></button></div>
      <div class="zone-card" id="zoneCard"></div>
      ${canSpeak ? '<button class="action" id="zoneSay" type="button">Hear it in a robot voice</button>' : ''}
      <p class="muted">Rough spellings, not yet checked by native speakers, and these zones blur into each other. The robot voice speaks standard Hindi, so real speakers will sound very different.</p></div>`);
    const render = () => {
      const z = DIALECTS[at];
      $('#zoneCard').innerHTML = `<span>${esc(z.name)}, ${esc(z.where)}</span><b lang="hi">${esc(z.lines[line][0])}</b><i>${esc(z.lines[line][1])}</i>`;
      $('#zoneCard').style.borderColor = z.color;
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
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      state.layer.setStyle(ctx.style);
    };
    $('#zoneRange').addEventListener('input', (e) => { at = Number(e.target.value); render(); });
    box().querySelectorAll('[data-line]').forEach((b) => b.addEventListener('click', () => {
      line = Number(b.dataset.line);
      box().querySelectorAll('[data-line]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      render();
    }));
    $('#zoneSay')?.addEventListener('click', () => speak(DIALECTS[at].lines[line][0]));
    keepMapClear(state.layer.getBounds());
    render();
  }

  /* Aakhri karigar */
  function karigar() {
    const kinds = ['All', ...new Set(KARIGAR.map((k) => k.kind))];
    shell('Aakhri karigar', `<div class="g-pad"><p class="lead">Hard to find on purpose: go, ask around, buy something. Public places and trades only.</p>
      <div class="tags" id="kindTabs">${kinds.map((k, i) => `<button data-kind="${esc(k)}" aria-pressed="${i === 0}"><span>${esc(k)}</span></button>`).join('')}</div>
      <div id="kList"></div><p class="muted">Hand-collected. Many are spots to ask around, not exact addresses, so pins are approximate.</p></div>`);
    const render = (kind) => {
      box().querySelectorAll('[data-kind]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.kind === kind));
      pinList($('#kList'), KARIGAR.filter((k) => kind === 'All' || k.kind === kind), { label: (k) => k.what, sub: (k) => `${k.place}, ${k.district}. ${k.note}` });
    };
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
    shell('Ajeeb gaon', '<p class="lead g-lead">Every place below exists on the map. People live here, so we laugh at the name and not at them.</p><div id="ajList" class="g-pad">Loading…</div>');
    try {
      const list = await (await fetch('data/ajeeb.json')).json();
      if ($('#ajList')) pinList($('#ajList'), list, { label: (x) => x.name, sub: (x) => `${x.note}${x.area ? ` ${x.area}.` : ''}` });
    } catch (err) { $('#ajList').innerHTML = `<p class="empty">Could not load the list: ${esc(err.message)}.</p>`; }
  }

  const RUN = { hub, samay, radio, mausam, train, naak, bhasha, karigar, plate, ajeeb };

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
