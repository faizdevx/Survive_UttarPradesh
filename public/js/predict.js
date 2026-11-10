// Chunav 2027 prediction: start from the 2022 result, move it, share it, and get scored when counting ends.
// Picks live in this browser only. Nothing is pooled, so the site never publishes a poll of its own.
import { PARTIES, ELECTION } from './content.js';

export const PICKABLE = ['BJP', 'SP', 'BSP', 'INC', 'RLD', 'ADS', 'SBSP', 'NISHAD', 'ASP', 'JDL', 'OTH'];
export const MAJORITY = 202;
const colourOf = (p) => PARTIES[p]?.color || '#8a8a8a';
const nameOf = (p) => (p === 'OTH' ? 'Others' : PARTIES[p]?.name || p);
const known = (p) => (PICKABLE.includes(p) ? p : 'OTH');

// Only seats that differ from 2022 are written: seat number in base 36, then one letter for the party
export function encode(picks, seats) {
  return Object.values(seats).filter((s) => picks[s.no] !== s.party)
    .map((s) => s.no.toString(36).padStart(2, '0') + String.fromCharCode(97 + PICKABLE.indexOf(picks[s.no]))).join('');
}
export function decode(code, seats) {
  const picks = {};
  Object.values(seats).forEach((s) => { picks[s.no] = s.party; });
  for (let i = 0; i + 3 <= (code || '').length; i += 3) {
    const part = code.slice(i, i + 3);
    const no = parseInt(part.slice(0, 2), 36);
    // Links arrive from strangers, so anything that is not a seat and a party is skipped
    if (/^[0-9a-z]{2}[a-k]$/.test(part) && seats[no]) picks[no] = PICKABLE[part.charCodeAt(2) - 97];
  }
  return picks;
}

// Uniform swing, the standard first guess in election maths: the same share of the vote moves from one
// party to the other in every seat. A seat changes hands when the move is bigger than half the 2022 gap.
// shortcut: only the top two of 2022 are in the data, so a third-placed party cannot gain here. Upgrade when full 2022 counts are added.
export function swing(seats, picks, from, to, points) {
  const out = { ...picks };
  Object.values(seats).forEach((s) => {
    if (s.party === from && s.runnerParty === to && s.pct - s.runnerPct < 2 * points) out[s.no] = to;
  });
  return out;
}

export function tally(picks) {
  const t = {};
  Object.values(picks).forEach((p) => { t[p] = (t[p] || 0) + 1; });
  return Object.entries(t).sort((a, b) => b[1] - a[1]);
}

// results: { seat number: party }. Parties outside the list count as Others on both sides.
export function score(picks, results) {
  const nos = Object.keys(results);
  return { right: nos.filter((no) => known(picks[no]) === known(results[no])).length, of: nos.length };
}

// Section 126A of the Representation of the People Act bars publishing forecasts from the first vote
// until the last booth closes, and Section 126 covers the 48 hours before polling.
export function sharingBarred(now = Date.now(), dates = ELECTION.pollDates) {
  if (!dates.length) return false;
  const start = new Date(`${dates[0]}T07:00:00+05:30`) - 48 * 3600000;
  const end = new Date(`${dates[dates.length - 1]}T18:30:00+05:30`).getTime();
  return now >= start && now <= end;
}

export function initPredict(ctx) {
  const { $, esc, store, state, chunav, enterChunav, restyle, shareOut } = ctx;
  const me = { on: false, picks: null, brush: null, results: null, shared: false };
  const box = () => $('#dossier');
  const code = () => encode(me.picks, chunav.seats);

  const verdict = (t) => {
    const [top, n] = t[0];
    return n >= MAJORITY ? `${nameOf(top)} wins a majority alone with ${n} seats.` : `No party reaches ${MAJORITY} alone. ${nameOf(top)} is largest with ${n}, so it needs partners.`;
  };

  function save() {
    me.shared = false;
    store.set('predict', code());
    history.replaceState(null, '', `#predict${code() ? `/${code()}` : ''}`);
    restyle();
    paint();
  }

  function paint() {
    const t = tally(me.picks);
    const was = Object.fromEntries(tally(decode('', chunav.seats)));
    const changed = Object.values(chunav.seats).filter((s) => me.picks[s.no] !== s.party);
    $('#pVerdict').textContent = verdict(t);
    $('#pTally').innerHTML = t.map(([p, n]) => `<i style="width:${(100 * n) / 403}%;background:${colourOf(p)}" title="${esc(nameOf(p))}: ${n}"></i>`).join('');
    $('#pTally').setAttribute('aria-label', `Your prediction. ${t.map(([p, n]) => `${nameOf(p)} ${n}`).join(', ')}. ${MAJORITY} needed for a majority.`);
    $('#pCounts').innerHTML = t.map(([p, n]) => {
      const d = n - (was[p] || 0);
      return `<li><i style="background:${colourOf(p)}"></i>${esc(nameOf(p))} <b>${n}</b>${d ? `<small>${d > 0 ? `up ${d}` : `down ${-d}`} from 2022</small>` : ''}</li>`;
    }).join('');
    $('#pChanged').innerHTML = changed.length
      ? `<h3>Seats you changed: ${changed.length}</h3><ul class="list">${changed.slice(0, 60).map((s) => `<li><button class="link" data-seat="${s.no}">${esc(s.name)}</button><span class="meta">${esc(nameOf(s.party))} in 2022, ${esc(nameOf(me.picks[s.no]))} in your map. 2022 gap: ${(s.pct - s.runnerPct).toFixed(1)} points.</span></li>`).join('')}</ul>${changed.length > 60 ? `<p class="muted">And ${changed.length - 60} more.</p>` : ''}`
      : '<p class="muted">Your map is still the 2022 result. Change a seat to start.</p>';
    if (me.results) {
      const r = score(me.picks, me.results);
      $('#pScore').innerHTML = `<b>You called ${r.right} of ${r.of} seats right.</b> Predictions are closed now that results are out.`;
    }
  }

  // The picture people forward: the map, the tally and the verdict, drawn here in the browser
  async function picture() {
    const W = 1080;
    const H = 1350;
    const c = Object.assign(document.createElement('canvas'), { width: W, height: H });
    const g = c.getContext('2d');
    await document.fonts.load('80px Anton').catch(() => {});
    g.fillStyle = '#7c1113'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#e9b949'; g.lineWidth = 6; g.strokeRect(16, 16, W - 32, H - 32);
    g.fillStyle = '#f6c400'; g.font = '44px Anton, Impact, sans-serif'; g.fillText('MY PREDICTION', 60, 100);
    g.fillStyle = '#f8ecd0'; g.font = '96px Anton, Impact, sans-serif'; g.fillText('UP CHUNAV 2027', 60, 196);

    let [x0, y0, x1, y1] = [180, 90, -180, -90];
    const rings = chunav.geo.features.flatMap((f) => f.geometry.coordinates.map((poly) => [f.properties.no, poly[0]]));
    rings.forEach(([, ring]) => ring.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }));
    // Longitude shrinks with latitude, so it is scaled by the cosine at the middle of UP
    const squash = Math.cos((27 * Math.PI) / 180);
    const k = Math.min(960 / ((x1 - x0) * squash), 700 / (y1 - y0));
    const left = (W - (x1 - x0) * squash * k) / 2;
    g.lineWidth = 0.6; g.strokeStyle = '#00000080';
    rings.forEach(([no, ring]) => {
      g.beginPath();
      ring.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](left + (x - x0) * squash * k, 250 + (y1 - y) * k));
      g.closePath();
      g.fillStyle = colourOf(me.picks[no]); g.fill(); g.stroke();
    });

    const t = tally(me.picks);
    let x = 60;
    t.forEach(([p, n]) => { const w = (960 * n) / 403; g.fillStyle = colourOf(p); g.fillRect(x, 1000, w, 46); x += w; });
    g.fillStyle = '#fff'; g.fillRect(60 + (960 * MAJORITY) / 403 - 2, 988, 4, 70);
    g.font = '26px Mukta, sans-serif'; g.fillText(`${MAJORITY} to win`, 60 + (960 * MAJORITY) / 403 + 10, 985);
    g.font = '50px Anton, Impact, sans-serif';
    x = 60;
    t.slice(0, 4).forEach(([p, n]) => {
      g.fillStyle = colourOf(p); g.fillRect(x, 1090, 26, 44);
      g.fillStyle = '#f8ecd0';
      const label = `${p === 'OTH' ? 'Others' : p} ${n}`;
      g.fillText(label, x + 38, 1131);
      x += g.measureText(label).width + 80;
    });
    g.font = '32px Mukta, sans-serif'; g.fillStyle = '#f8ecd0'; g.fillText(verdict(t), 60, 1205, 960);
    g.fillStyle = '#f6c400'; g.fillText('One person’s guess, not a poll. Make yours: Survive Uttar Pradesh', 60, 1280, 960);
    return new Promise((done) => c.toBlob(done, 'image/jpeg', 0.9));
  }

  function render() {
    const b = box();
    const closed = Boolean(me.results);
    const barred = sharingBarred();
    b.hidden = false;
    b.classList.remove('peek');
    b.classList.add('sheet');
    b.scrollTop = 0;
    const options = (list) => list.map((p) => `<option value="${p}">${esc(nameOf(p))}</option>`).join('');
    b.innerHTML = `<button class="close" id="closeBtn" aria-label="Close">X</button>
      <header class="g-head"><h1>My 2027 prediction</h1></header>
      <div class="g-body"><div class="g-pad predict">
        ${me.shared ? '<p class="p-flag">Someone sent you this map. Change any seat and it becomes yours.</p>' : ''}
        <p class="lead" id="pVerdict"></p>
        <div class="tally" id="pTally" role="img"></div>
        <ul class="p-counts" id="pCounts"></ul>
        <p class="lead" id="pScore">${closed ? '' : 'Results are not out. Your picks stay on this phone, and this page scores them seat by seat once counting ends.'}</p>
        <fieldset ${closed ? 'disabled' : ''}>
          <h3>Change one seat at a time</h3>
          <p class="muted">Pick a party, then tap seats on the map.</p>
          <div class="tags" id="pBrush">${PICKABLE.map((p) => `<button type="button" aria-pressed="false" data-brush="${p}"><i style="background:${colourOf(p)}"></i>${esc(nameOf(p))}</button>`).join('')}</div>
          <h3>Or move votes across the whole state</h3>
          <div class="p-swing">
            <label>From <select id="pFrom">${options(['BJP', 'SP', 'RLD', 'ADS', 'SBSP', 'NISHAD', 'INC', 'BSP', 'JDL'])}</select></label>
            <label>To <select id="pTo">${options(['SP', 'BJP', 'BSP', 'RLD', 'INC', 'ADS', 'SBSP', 'NISHAD'])}</select></label>
            <label>How much <input id="pPoints" type="range" min="0.5" max="15" step="0.5" value="3"> <output id="pOut">3 points</output></label>
            <button class="action" id="pApply" type="button">Apply to every seat</button>
          </div>
          <p class="muted" id="pSwingNote">Takes that share of the vote from one party and gives it to the other in every seat where the two finished first and second in 2022. It is a starting guess: alliances, new candidates and the redrawn voter list are not in it.</p>
          <button class="action ghost" id="pReset" type="button">Back to the 2022 result</button>
        </fieldset>
        <h3>Send it</h3>
        ${barred ? '<p class="lead">Sharing is off while voting is on. Election law bars publishing forecasts from 48 hours before polling until the last booth closes.</p>'
    : '<div class="rc-actions"><button class="action" id="pShare" type="button">Share my map</button><button class="action ghost" id="pSave" type="button">Save the picture</button><button class="action ghost" id="pLink" type="button">Copy the link</button></div><p class="muted">The picture says it is one person’s guess. This site adds up nobody’s picks and runs no poll.</p>'}
        <div id="pChanged"></div>
      </div></div>`;
    $('#closeBtn').addEventListener('click', ctx.closeDossier);
    $('#pBrush').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-brush]');
      if (!btn) return;
      me.brush = btn.dataset.brush;
      b.querySelectorAll('[data-brush]').forEach((x) => x.setAttribute('aria-pressed', x === btn));
    });
    $('#pPoints').addEventListener('input', (e) => { $('#pOut').textContent = `${e.target.value} points`; });
    $('#pApply').addEventListener('click', () => {
      const [from, to, points] = [$('#pFrom').value, $('#pTo').value, Number($('#pPoints').value)];
      const before = code();
      me.picks = swing(chunav.seats, me.picks, from, to, points);
      save();
      const flipped = Object.values(chunav.seats).filter((s) => s.party === from && me.picks[s.no] === to && s.runnerParty === to).length;
      $('#pSwingNote').textContent = before === code() ? `Nothing changed. No ${nameOf(from)} seat had ${nameOf(to)} within ${points * 2} points in 2022.` : `Done. ${flipped} ${nameOf(from)} seats are now ${nameOf(to)}, because the 2022 gap there was under ${points * 2} points.`;
    });
    $('#pReset').addEventListener('click', () => { me.picks = decode('', chunav.seats); save(); });
    $('#pChanged').addEventListener('click', (e) => {
      const no = Number(e.target.closest('[data-seat]')?.dataset.seat);
      const shape = chunav.layer.getLayers().find((l) => l.feature.properties.no === no);
      if (shape) state.map.flyToBounds(shape.getBounds(), { maxZoom: 10 });
    });
    const link = () => `${location.origin}/predict${code() ? `/${code()}` : ''}`;
    const words = () => `My UP 2027 prediction: ${tally(me.picks).slice(0, 3).map(([p, n]) => `${p === 'OTH' ? 'Others' : p} ${n}`).join(', ')}. Make yours:`;
    const file = async () => new File([await picture()], 'up-2027-prediction.jpg', { type: 'image/jpeg' });
    $('#pShare')?.addEventListener('click', async () => { if (await shareOut({ title: 'My UP 2027 prediction', text: words(), url: link(), file: await file() }) === 'copied') $('#pShare').textContent = 'Link copied'; });
    $('#pSave')?.addEventListener('click', async () => Object.assign(document.createElement('a'), { href: URL.createObjectURL(await file()), download: 'up-2027-prediction.jpg' }).click());
    $('#pLink')?.addEventListener('click', async () => { await navigator.clipboard.writeText(link()); $('#pLink').textContent = 'Link copied'; });
    paint();
  }

  async function open(shared) {
    await enterChunav();
    const mine = store.get('predict') || '';
    me.on = true;
    me.brush = null;
    me.shared = shared != null && shared !== mine;
    me.picks = decode(shared ?? mine, chunav.seats);
    // The results file is added to the site once counting ends. Until then this is a 404.
    me.results ??= await fetch('data/results-2027.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
    history.replaceState(null, '', `#predict${code() ? `/${code()}` : ''}`);
    render();
    restyle();
  }

  return {
    open,
    on: () => me.on,
    partyOf: (no) => me.picks[no],
    leave() { if (me.on) { me.on = false; restyle(); } },
    pick(no) {
      if (me.results) return;
      if (!me.brush) { $('#pBrush').scrollIntoView({ block: 'center' }); $('#pBrush button').focus(); return; }
      me.picks[no] = me.brush;
      save();
    },
  };
}
