// Aas-paas: big tiles for the problems around you. One tap to report, the count of people nearby comes straight back.
const $ = (s, el = document) => el.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private window */ } },
};

// A random id made on this phone. It is the only "login": no name, no number.
let device = store.get('device');
if (!device) {
  device = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  store.set('device', device);
}

const TOPICS = {
  bijli: { em: '💡', name: 'Power', q: 'Do you have power?', yes: 'Yes', no: 'No power', badSay: 'no power', okSay: 'power is on' },
  paani: { em: '🚰', name: 'Water', q: 'Is water coming in the tap?', yes: 'Yes', no: 'No water', badSay: 'no water in the tap', okSay: 'water is coming' },
  net: { em: '📶', name: 'Network', q: 'Which SIM do you use?', subs: { jio: 'Jio', airtel: 'Airtel', vi: 'Vi', bsnl: 'BSNL' }, yes: 'Working', no: 'Not working', badSay: 'internet not working', okSay: 'internet working' },
  sadak: { em: '🛣️', name: 'Roads, drains', photo: true },
  jam: { em: '🚗', name: 'Traffic', q: 'How is the road?', subs: { jam: '🚗 Traffic jam', band: '🚧 Road closed' }, clear: '✅ Road is clear', badSay: 'jam or road closed', okSay: 'road is clear' },
  suraksha: { em: '🛡️', name: 'Safety', q: 'What is the problem here?', subs: { andhera: '🌑 Dark at night, no lights', asurakshit: '⚠️ Feels unsafe here' }, badSay: 'area feels dark or unsafe', okSay: '' },
};
const KINDS = { gaddha: '🕳️ Pothole', naali: '🌊 Blocked drain, waterlogging', khamba: '💡 Streetlight not working', kooda: '🗑️ Garbage' };
const PARTY = { SP: 'Samajwadi Party', INC: 'Congress', 'Apna Dal (Soneylal)': 'Apna Dal (S)', 'Suheldev Bharatiya Samaj Party': 'SBSP', 'Nirbal Indian Shoshit Hamara Aam Dal': 'NISHAD Party', 'Jansatta Dal Loktantrik': 'Jansatta Dal (L)' };

const me = { lat: null, lng: null, data: null, timer: null };
const sheet = $('#sheet');

async function call(url, body) {
  const r = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, device, lat: me.lat, lng: me.lng }) } : undefined);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Network problem. Try again.');
  return j;
}

function open(html) {
  $('#sheetBody').innerHTML = html;
  sheet.hidden = false;
  $('#sheetClose').focus();
}
function close() {
  sheet.hidden = true;
  if (location.pathname !== '/') history.replaceState(null, '', '/');
}
$('#sheetClose').addEventListener('click', close);
sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) close(); });

const ago = (m) => (m == null ? '' : m < 60 ? `for ${m} min` : `for ${Math.round(m / 60)} hr`);
const place = () => me.data?.place;
const placeLine = () => (place() ? `${place().seatName}, ${place().district}` : 'My area');
const wa = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;

// Location
async function setPlace(lat, lng) {
  me.lat = lat;
  me.lng = lng;
  store.set('where', JSON.stringify([lat, lng]));
  await refresh();
  $('#start').hidden = true;
  $('#home').hidden = false;
  clearInterval(me.timer);
  me.timer = setInterval(refresh, 60000);
}
function gps() {
  const btn = $('#useGps');
  btn.textContent = '📍 Finding you…';
  navigator.geolocation.getCurrentPosition(
    (p) => setPlace(p.coords.latitude, p.coords.longitude).catch((err) => { btn.textContent = `📍 ${err.message}`; }),
    () => { btn.textContent = '📍 Location not found. Pick your district below.'; },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 },
  );
}
$('#useGps').addEventListener('click', gps);
$('#placeBtn').addEventListener('click', () => { $('#home').hidden = true; $('#start').hidden = false; $('#useGps').textContent = '📍 Use my location'; });
fetch('/data/districts.json').then((r) => r.json()).then((d) => {
  const names = Object.values(d).filter((x) => x.lat != null).sort((a, b) => a.name.localeCompare(b.name));
  $('#districtPick').insertAdjacentHTML('beforeend', names.map((x) => `<option value="${x.lat},${x.lng}">${esc(x.name)}</option>`).join(''));
});
$('#districtPick').addEventListener('change', (e) => {
  if (!e.target.value) return;
  const [lat, lng] = e.target.value.split(',').map(Number);
  setPlace(lat, lng).catch((err) => alert(err.message));
});

// Home
async function refresh() {
  me.data = await call(`/api/p/near?lat=${me.lat}&lng=${me.lng}&device=${device}`);
  if (!me.data.place) throw new Error('This place is not in Uttar Pradesh');
  $('#placeName').textContent = placeLine();
  paintTiles();
  paintMla();
  paintCases();
  call('/api/p/state').then(paintState).catch(() => {});
}

function paintTiles() {
  const t = me.data.topics;
  const open = me.data.cases.filter((c) => !c.fixed).length;
  $('#tiles').innerHTML = Object.entries(TOPICS).map(([key, x]) => {
    let line = 'No reports yet. Tell us';
    let cls = '';
    if (key === 'sadak') {
      line = open ? `${open} open nearby` : 'Send a photo';
      cls = open ? 'bad' : '';
    } else if (t[key].bad) {
      line = `${t[key].bad} report a problem`;
      cls = t[key].bad >= t[key].ok ? 'bad' : 'ok';
    } else if (t[key].ok) {
      line = `${t[key].ok} say all fine`;
      cls = 'ok';
    }
    const mine = t[key]?.mine ? `<span class="me">You told</span>` : '';
    return `<button class="tile ${cls}" data-topic="${key}" type="button">${mine}<span class="em" aria-hidden="true">${x.em}</span><span class="name">${x.name}</span><span class="num">${line}</span></button>`;
  }).join('');
}
$('#tiles').addEventListener('click', (e) => {
  const key = e.target.closest('[data-topic]')?.dataset.topic;
  if (key === 'sadak') askCase();
  else if (key) ask(key);
});

function paintMla() {
  const p = place();
  if (!p?.mla) { $('#mlaBlock').hidden = true; return; }
  const open = me.data.cases.filter((c) => !c.fixed);
  $('#mlaBlock').hidden = false;
  $('#mlaBlock').innerHTML = `<h2>🏛️ Your MLA</h2><div class="mla">
    <p><b>${esc(p.mla)}</b>, ${esc(PARTY[p.mlaParty] || p.mlaParty || '')}. ${esc(p.seatName)} seat.</p>
    <p>${open.length ? `<b>${open.length}</b> complaints are open in this area.` : 'No open complaints in this area.'}</p>
    <div class="row">
      ${open.length ? `<a class="btn wa" target="_blank" rel="noopener" href="${wa(digestText(open))}">Send to your MLA</a>` : ''}
      <a class="btn" target="_blank" rel="noopener" href="https://jansunwai.up.nic.in/">Complain on Jansunwai</a>
      <a class="btn" href="tel:1076">📞 CM helpline 1076</a>
      <a class="btn" href="/seat/${p.seat}">MLA report card</a>
    </div></div>`;
}
function digestText(open) {
  const p = place();
  return `Respected ${p.mla} ji,\nThese complaints are open in ${p.seatName} (${p.district}):\n\n${open.slice(0, 10).map((c, i) => `${i + 1}. ${KINDS[c.kind]}, ${c.confirms} people, open ${c.days} days\n${location.origin}/case/${c.id}`).join('\n\n')}\n\nPlease get them fixed.`;
}

function caseCard(c) {
  return `<article class="case${c.fixed ? ' fixed' : ''}">
    <img src="${esc(c.photo)}" alt="Photo: ${esc(KINDS[c.kind])}" loading="lazy">
    <div><h3>${esc(KINDS[c.kind])}${c.fixed ? ' ✅ Fixed' : ''}</h3>
      <p class="meta">👥 ${c.confirms} people · ${c.days ? `${c.days} days` : 'today'}${c.km != null ? ` · ${c.km} km` : ''}</p>
      <div class="row">
        ${c.fixed ? '' : `<button class="btn" data-vote="confirm" data-id="${c.id}" type="button">${c.mine ? '✔️ You said' : '👍 Me too'}</button>
        <button class="btn" data-vote="fixed" data-id="${c.id}" type="button">✅ It's fixed</button>`}
        <a class="btn wa" target="_blank" rel="noopener" href="${wa(`${KINDS[c.kind]}, ${c.seatName} (${c.district}): ${c.confirms} people affected, open ${c.days} days. See it and add your voice: ${location.origin}/case/${c.id}`)}">Share</a>
      </div></div></article>`;
}
function paintCases() {
  const list = me.data.cases;
  $('#cases').innerHTML = list.length ? list.map(caseCard).join('') : '<p class="empty">No complaints nearby. See a broken road or blocked drain? Tap 🛣️ above and send a photo.</p>';
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-vote]');
  if (!b) return;
  if (b.dataset.vote === 'flag' && !confirm('Is this photo wrong or private?')) return;
  b.disabled = true;
  try {
    await call(`/api/p/case/${b.dataset.id}/vote`, { what: b.dataset.vote });
    b.textContent = b.dataset.vote === 'flag' ? 'Reported' : '✔️ Done';
    if (me.lat) refresh();
  } catch (err) { b.textContent = err.message; }
});

function paintState(s) {
  const lines = ['bijli', 'paani', 'net', 'jam'].filter((k) => s.topics[k].length).map((k) => `<div>${TOPICS[k].em} <b>${TOPICS[k].name}</b>: ${s.topics[k].map(([d, n]) => `${esc(d)} (${n})`).join(', ')}</div>`);
  if (s.seats.length) lines.push(`<div>🛣️ <b>Most complaints</b>: ${s.seats.slice(0, 5).map((x) => `${esc(x.seatName)} (${x.open})`).join(', ')}</div>`);
  $('#stateNow').innerHTML = lines.join('') || '<p class="empty">Nobody has reported anything yet. Be the first.</p>';
}

// One-tap questions
function ask(key, sub) {
  const x = TOPICS[key];
  if (x.subs && !sub && key === 'net') {
    open(`<p class="q" id="sheetTitle">${x.em} ${x.q}</p><div class="choices">${Object.entries(x.subs).map(([k, v]) => `<button class="choice plain" data-sub="${k}" type="button">📱 ${v}</button>`).join('')}</div>`);
    $('#sheetBody').querySelectorAll('[data-sub]').forEach((b) => b.addEventListener('click', () => ask(key, b.dataset.sub)));
    return;
  }
  let choices;
  if (key === 'jam' || key === 'suraksha') {
    choices = Object.entries(x.subs).map(([k, v]) => `<button class="choice bad" data-bad="1" data-sub="${k}" type="button">${v}</button>`).join('')
      + (x.clear ? `<button class="choice ok" data-bad="0" data-sub="jam" type="button">${x.clear}</button>` : '')
      + (key === 'suraksha' ? '<a class="choice plain" href="tel:112">📞 In danger now? Call 112</a>' : '');
  } else {
    choices = `<button class="choice ok" data-bad="0" type="button">✅ ${x.yes}</button><button class="choice bad" data-bad="1" type="button">❌ ${x.no}</button>`;
  }
  const title = key === 'net' ? `📶 Is ${x.subs[sub]} internet working?` : `${x.em} ${x.q}`;
  open(`<p class="q" id="sheetTitle">${title}</p><div class="choices">${choices}</div><p class="err" id="askErr"></p>`);
  $('#sheetBody').querySelectorAll('[data-bad]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try {
      me.data = await call('/api/p/tap', { topic: key, bad: b.dataset.bad === '1', sub: b.dataset.sub || sub });
      paintTiles();
      result(key, b.dataset.bad === '1', b.dataset.sub || sub);
    } catch (err) { $('#askErr').textContent = err.message; b.disabled = false; }
  }));
}

function result(key, bad, sub) {
  const x = TOPICS[key];
  const t = me.data.topics[key];
  // On the network tile the count is for the same SIM, since Jio being down says nothing about Airtel
  const n = bad ? (key === 'net' ? t.subs[sub] : t.bad) : t.ok;
  const others = n - 1;
  const where = placeLine();
  const head = bad
    ? (others > 0 ? `You're not alone` : `You're the first to report`)
    : 'Good to hear. Thanks for telling us';
  const split = key === 'net' && t.bad ? `<div class="split">${Object.entries(x.subs).map(([k, v]) => `<span>${v}: ${t.subs[k]}</span>`).join('')}</div>` : '';
  const who = `${n} ${n === 1 ? 'person' : 'people'}`;
  const say = `${key === 'net' && bad ? `${x.subs[sub]} ` : ''}${bad ? x.badSay : x.okSay}`;
  const share = bad
    ? `${where}: ${who} report ${say}${t.since ? ` (${ago(t.since)})` : ''}. What about you? Tell us in one tap: ${location.origin}`
    : `See the ${x.name.toLowerCase()} situation in ${where}, in one tap: ${location.origin}`;
  open(`<div class="result">
    <p class="q" id="sheetTitle">${head}</p>
    <div class="big${bad ? '' : ' ok'}">${n}</div>
    <p>${who} within 2 km: <b>${say}</b>${bad && t.since ? `, ${ago(t.since)}` : ''}</p>
    ${split}
    <div class="row"><a class="btn wa" target="_blank" rel="noopener" href="${wa(share)}">Tell others on WhatsApp</a>
    ${bad && key === 'bijli' ? '<a class="btn" href="tel:1912">📞 Power complaint 1912</a>' : ''}
    ${bad && key === 'suraksha' ? '<a class="btn" href="tel:1090">📞 Women helpline 1090</a>' : ''}
    <button class="btn main" id="done" type="button">OK</button></div>
    ${bad && key !== 'suraksha' ? `<p class="note">Counts clear on their own after a few hours. If things change, tap again.</p>` : ''}
  </div>`);
  $('#done').addEventListener('click', close);
}

// Photo cases
function askCase() {
  open(`<p class="q" id="sheetTitle">🛣️ What is broken?</p><div class="choices">${Object.entries(KINDS).map(([k, v]) => `<button class="choice plain" data-kind="${k}" type="button">${v}</button>`).join('')}</div>
    <p class="note">Just take a photo. Your seat and MLA are found from your location.</p>`);
  $('#sheetBody').querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => { me.kind = b.dataset.kind; $('#camera').value = ''; $('#camera').click(); }));
}

// The photo is re-drawn on the phone: smaller to send, and the camera's hidden GPS tags are left behind
async function shrink(file) {
  const img = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  if (!img) throw new Error('That photo did not open. Take another.');
  const k = Math.min(1, 1280 / Math.max(img.width, img.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  for (const q of [0.72, 0.6, 0.45, 0.35]) {
    const url = c.toDataURL('image/jpeg', q);
    if (url.length * 0.75 < 580000) return url;
  }
  throw new Error('Photo is too large.');
}
$('#camera').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  let photo;
  try { photo = await shrink(file); } catch (err) { open(`<p class="err">${esc(err.message)}</p>`); return; }
  open(`<p class="q" id="sheetTitle">${KINDS[me.kind]}</p><img class="shot" src="${photo}" alt="Your photo">
    <p class="note">Try to keep faces and number plates out. Everyone can see this photo.</p>
    <div class="row"><button class="btn main" id="send" type="button">📤 Send</button><button class="btn" id="again" type="button">Retake</button></div><p class="err" id="caseErr"></p>`);
  $('#again').addEventListener('click', () => { $('#camera').value = ''; $('#camera').click(); });
  $('#send').addEventListener('click', async () => {
    $('#send').disabled = true;
    $('#send').textContent = 'Sending…';
    try {
      const c = await call('/api/p/case', { kind: me.kind, photo });
      await refresh();
      showCase(c, true);
    } catch (err) { $('#caseErr').textContent = err.message; $('#send').disabled = false; $('#send').textContent = '📤 Send'; }
  });
});

function showCase(c, fresh) {
  open(`${fresh ? `<p class="q" id="sheetTitle">Complaint posted</p>` : `<p class="q" id="sheetTitle">${esc(KINDS[c.kind])}</p>`}
    <img class="shot" src="${esc(c.photo)}" alt="Photo: ${esc(KINDS[c.kind])}">
    <p>${esc(c.seatName)}, ${esc(c.district)}. 👥 <b>${c.confirms}</b> ${c.confirms === 1 ? 'person' : 'people'} · ${c.days ? `${c.days} days` : 'today'}${c.mla ? ` · MLA: ${esc(c.mla)}` : ''}</p>
    ${fresh ? '<p>Send it to your neighbours. The more people tap "Me too", the more weight it carries.</p>' : ''}
    <div class="row">
      <a class="btn wa" target="_blank" rel="noopener" href="${wa(`${KINDS[c.kind]}, ${c.seatName} (${c.district}): ${c.confirms} people affected. See it and add your voice: ${location.origin}/case/${c.id}`)}">Share on WhatsApp</a>
      ${c.fixed ? '' : `<button class="btn" data-vote="confirm" data-id="${c.id}" type="button">👍 Me too</button><button class="btn" data-vote="fixed" data-id="${c.id}" type="button">✅ It's fixed</button>`}
      <button class="btn" data-vote="flag" data-id="${c.id}" type="button">⚠️ Wrong photo</button>
    </div>`);
}

// Start: a shared case link opens that case, a saved place opens straight to the tiles
const shared = location.pathname.match(/^\/case\/([0-9a-f]{12})$/);
const saved = JSON.parse(store.get('where') || 'null');
(async () => {
  if (saved) await setPlace(...saved).catch(() => {});
  if (shared) {
    try { showCase(await call(`/api/p/case/${shared[1]}`)); } catch { open('<p class="err">This complaint no longer exists.</p>'); }
  }
})();
