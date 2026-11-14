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
  bijli: { em: '💡', name: 'बिजली', q: 'आपके यहाँ बिजली है?', yes: 'है', no: 'नहीं है', badSay: 'बिजली नहीं है', okSay: 'बिजली है' },
  paani: { em: '🚰', name: 'पानी', q: 'नल में पानी आ रहा है?', yes: 'आ रहा है', no: 'नहीं आ रहा', badSay: 'नल में पानी नहीं आ रहा', okSay: 'पानी आ रहा है' },
  net: { em: '📶', name: 'नेटवर्क', q: 'कौन सा सिम है?', subs: { jio: 'Jio', airtel: 'Airtel', vi: 'Vi', bsnl: 'BSNL' }, yes: 'चल रहा है', no: 'नहीं चल रहा', badSay: 'नेट नहीं चल रहा', okSay: 'नेट ठीक चल रहा' },
  sadak: { em: '🛣️', name: 'सड़क, नाली', photo: true },
  jam: { em: '🚗', name: 'जाम, रास्ता', q: 'रास्ते का क्या हाल है?', subs: { jam: '🚗 जाम है', band: '🚧 रास्ता बंद' }, clear: '✅ रास्ता साफ़', badSay: 'जाम है या रास्ता बंद', okSay: 'रास्ता साफ़ है' },
  suraksha: { em: '🛡️', name: 'सुरक्षा', q: 'इस इलाके में क्या दिक्कत है?', subs: { andhera: '🌑 रात में अंधेरा, बत्ती नहीं', asurakshit: '⚠️ यहाँ डर लगता है' }, badSay: 'इलाके में अंधेरा या डर', okSay: '' },
};
const KINDS = { gaddha: '🕳️ गड्ढा', naali: '🌊 नाली, पानी भरा', khamba: '💡 खंभे की बत्ती खराब', kooda: '🗑️ कूड़ा' };
const PARTY = { BJP: 'भाजपा', SP: 'सपा', BSP: 'बसपा', INC: 'कांग्रेस', RLD: 'रालोद', 'Apna Dal (Soneylal)': 'अपना दल', 'Suheldev Bharatiya Samaj Party': 'सुभासपा', 'Nirbal Indian Shoshit Hamara Aam Dal': 'निषाद पार्टी', 'Jansatta Dal Loktantrik': 'जनसत्ता दल' };

const me = { lat: null, lng: null, data: null, timer: null };
const sheet = $('#sheet');

async function call(url, body) {
  const r = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, device, lat: me.lat, lng: me.lng }) } : undefined);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'नेटवर्क की दिक्कत। फिर कोशिश करें।');
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

const ago = (m) => (m == null ? '' : m < 60 ? `${m} मिनट से` : `${Math.round(m / 60)} घंटे से`);
const place = () => me.data?.place;
const placeLine = () => (place() ? `${place().seatName}, ${place().district}` : 'मेरे इलाके');
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
  btn.textContent = '📍 जगह ढूँढ रहे हैं…';
  navigator.geolocation.getCurrentPosition(
    (p) => setPlace(p.coords.latitude, p.coords.longitude).catch((err) => { btn.textContent = `📍 ${err.message}`; }),
    () => { btn.textContent = '📍 जगह नहीं मिली। नीचे ज़िला चुनें।'; },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 },
  );
}
$('#useGps').addEventListener('click', gps);
$('#placeBtn').addEventListener('click', () => { $('#home').hidden = true; $('#start').hidden = false; $('#useGps').textContent = '📍 मेरी जगह बताओ'; });
fetch('/data/districts.json').then((r) => r.json()).then((d) => {
  // Some districts have no Hindi name in the data, so they fall back to English
  const hi = (x) => x.city?.hi || x.name;
  const names = Object.values(d).filter((x) => x.lat != null).sort((a, b) => hi(a).localeCompare(hi(b), 'hi'));
  $('#districtPick').insertAdjacentHTML('beforeend', names.map((x) => `<option value="${x.lat},${x.lng}">${esc(hi(x))}${hi(x) === x.name ? '' : ` (${esc(x.name)})`}</option>`).join(''));
});
$('#districtPick').addEventListener('change', (e) => {
  if (!e.target.value) return;
  const [lat, lng] = e.target.value.split(',').map(Number);
  setPlace(lat, lng).catch((err) => alert(err.message));
});

// Home
async function refresh() {
  me.data = await call(`/api/p/near?lat=${me.lat}&lng=${me.lng}&device=${device}`);
  if (!me.data.place) throw new Error('यह जगह उत्तर प्रदेश में नहीं है');
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
    let line = 'कोई खबर नहीं, आप बताओ';
    let cls = '';
    if (key === 'sadak') {
      line = open ? `${open} शिकायत पास में` : 'फोटो खींचकर बताओ';
      cls = open ? 'bad' : '';
    } else if (t[key].bad) {
      line = `${t[key].bad} लोग: दिक्कत`;
      cls = t[key].bad >= t[key].ok ? 'bad' : 'ok';
    } else if (t[key].ok) {
      line = `${t[key].ok} लोग: सब ठीक`;
      cls = 'ok';
    }
    const mine = t[key]?.mine ? `<span class="me">आपने बताया</span>` : '';
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
  $('#mlaBlock').innerHTML = `<h2>🏛️ आपके विधायक</h2><div class="mla">
    <p><b>${esc(p.mla)}</b>, ${esc(PARTY[p.mlaParty] || p.mlaParty || '')}. ${esc(p.seatName)} सीट।</p>
    <p>${open.length ? `इस इलाके की <b>${open.length}</b> शिकायतें अभी खुली हैं।` : 'इस इलाके की कोई खुली शिकायत नहीं।'}</p>
    <div class="row">
      ${open.length ? `<a class="btn wa" target="_blank" rel="noopener" href="${wa(digestText(open))}">विधायक जी को भेजो</a>` : ''}
      <a class="btn" target="_blank" rel="noopener" href="https://jansunwai.up.nic.in/">जनसुनवाई पर शिकायत</a>
      <a class="btn" href="tel:1076">📞 1076</a>
      <a class="btn" href="/seat/${p.seat}">रिपोर्ट कार्ड</a>
    </div></div>`;
}
function digestText(open) {
  const p = place();
  return `माननीय विधायक ${p.mla} जी,\n${p.seatName} (${p.district}) में ये शिकायतें खुली हैं:\n\n${open.slice(0, 10).map((c, i) => `${i + 1}. ${KINDS[c.kind]}, ${c.confirms} लोग, ${c.days} दिन से\n${location.origin}/case/${c.id}`).join('\n\n')}\n\nकृपया ठीक करवाएं।`;
}

function caseCard(c) {
  return `<article class="case${c.fixed ? ' fixed' : ''}">
    <img src="${esc(c.photo)}" alt="${esc(KINDS[c.kind])} की फोटो" loading="lazy">
    <div><h3>${esc(KINDS[c.kind])}${c.fixed ? ' ✅ ठीक हुआ' : ''}</h3>
      <p class="meta">👥 ${c.confirms} लोग · ${c.days ? `${c.days} दिन से` : 'आज'}${c.km != null ? ` · ${c.km} km` : ''}</p>
      <div class="row">
        ${c.fixed ? '' : `<button class="btn" data-vote="confirm" data-id="${c.id}" type="button">${c.mine ? '✔️ आपने कहा' : '👍 मेरे यहाँ भी'}</button>
        <button class="btn" data-vote="fixed" data-id="${c.id}" type="button">✅ ठीक हो गया</button>`}
        <a class="btn wa" target="_blank" rel="noopener" href="${wa(`${KINDS[c.kind]}, ${c.seatName} (${c.district}): ${c.confirms} लोग परेशान, ${c.days} दिन से। देखो और साथ दो: ${location.origin}/case/${c.id}`)}">शेयर</a>
      </div></div></article>`;
}
function paintCases() {
  const list = me.data.cases;
  $('#cases').innerHTML = list.length ? list.map(caseCard).join('') : '<p class="empty">पास में कोई शिकायत नहीं। टूटी सड़क या भरी नाली दिखे तो ऊपर 🛣️ दबाकर फोटो भेजो।</p>';
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-vote]');
  if (!b) return;
  if (b.dataset.vote === 'flag' && !confirm('यह फोटो गलत या किसी की निजी है?')) return;
  b.disabled = true;
  try {
    await call(`/api/p/case/${b.dataset.id}/vote`, { what: b.dataset.vote });
    b.textContent = b.dataset.vote === 'flag' ? 'बता दिया' : '✔️ हो गया';
    if (me.lat) refresh();
  } catch (err) { b.textContent = err.message; }
});

function paintState(s) {
  const lines = ['bijli', 'paani', 'net', 'jam'].filter((k) => s.topics[k].length).map((k) => `<div>${TOPICS[k].em} <b>${TOPICS[k].name}</b>: ${s.topics[k].map(([d, n]) => `${esc(d)} (${n})`).join(', ')}</div>`);
  if (s.seats.length) lines.push(`<div>🛣️ <b>सबसे ज़्यादा शिकायतें</b>: ${s.seats.slice(0, 5).map((x) => `${esc(x.seatName)} (${x.open})`).join(', ')}</div>`);
  $('#stateNow').innerHTML = lines.join('') || '<p class="empty">अभी किसी ने कुछ नहीं बताया। पहले आप बताओ।</p>';
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
      + (key === 'suraksha' ? '<a class="choice plain" href="tel:112">📞 अभी खतरा है? 112 पर कॉल करें</a>' : '');
  } else {
    choices = `<button class="choice ok" data-bad="0" type="button">✅ ${x.yes}</button><button class="choice bad" data-bad="1" type="button">❌ ${x.no}</button>`;
  }
  const title = key === 'net' ? `📶 ${x.subs[sub]} का नेट?` : `${x.em} ${x.q}`;
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
    ? (others > 0 ? `आप अकेले नहीं हैं` : `आप पहले हैं जिसने बताया`)
    : 'बढ़िया, बताने के लिए शुक्रिया';
  const split = key === 'net' && t.bad ? `<div class="split">${Object.entries(x.subs).map(([k, v]) => `<span>${v}: ${t.subs[k]}</span>`).join('')}</div>` : '';
  const who = `${n} ${n === 1 ? 'व्यक्ति' : 'लोगों'} ने बताया`;
  const say = `${key === 'net' && bad ? `${x.subs[sub]} का ` : ''}${bad ? x.badSay : x.okSay}`;
  const share = bad
    ? `${where}: ${who}, ${say}${t.since ? ` (${ago(t.since)})` : ''}। आपके यहाँ क्या हाल है? एक टैप में बताओ: ${location.origin}`
    : `${where} में ${x.name} का हाल देखो, एक टैप में: ${location.origin}`;
  open(`<div class="result">
    <p class="q" id="sheetTitle">${head}</p>
    <div class="big${bad ? '' : ' ok'}">${n}</div>
    <p>2 km में ${who}: <b>${say}</b>${bad && t.since ? `, ${ago(t.since)}` : ''}</p>
    ${split}
    <div class="row"><a class="btn wa" target="_blank" rel="noopener" href="${wa(share)}">WhatsApp पर बताओ</a>
    ${bad && key === 'bijli' ? '<a class="btn" href="tel:1912">📞 बिजली शिकायत 1912</a>' : ''}
    ${bad && key === 'suraksha' ? '<a class="btn" href="tel:1090">📞 महिला हेल्पलाइन 1090</a>' : ''}
    <button class="btn main" id="done" type="button">ठीक है</button></div>
    ${bad && key !== 'suraksha' ? `<p class="note">गिनती हर कुछ घंटों में अपने-आप हट जाती है। हाल बदले तो फिर से दबाओ।</p>` : ''}
  </div>`);
  $('#done').addEventListener('click', close);
}

// Photo cases
function askCase() {
  open(`<p class="q" id="sheetTitle">🛣️ क्या खराब है?</p><div class="choices">${Object.entries(KINDS).map(([k, v]) => `<button class="choice plain" data-kind="${k}" type="button">${v}</button>`).join('')}</div>
    <p class="note">फोटो खींचो, बस। आपकी जगह से सीट और विधायक अपने-आप पता चलेंगे।</p>`);
  $('#sheetBody').querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => { me.kind = b.dataset.kind; $('#camera').value = ''; $('#camera').click(); }));
}

// The photo is re-drawn on the phone: smaller to send, and the camera's hidden GPS tags are left behind
async function shrink(file) {
  const img = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  if (!img) throw new Error('यह फोटो नहीं खुली। दूसरी खींचें।');
  const k = Math.min(1, 1280 / Math.max(img.width, img.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  for (const q of [0.72, 0.6, 0.45, 0.35]) {
    const url = c.toDataURL('image/jpeg', q);
    if (url.length * 0.75 < 580000) return url;
  }
  throw new Error('फोटो बहुत बड़ी है।');
}
$('#camera').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  let photo;
  try { photo = await shrink(file); } catch (err) { open(`<p class="err">${esc(err.message)}</p>`); return; }
  open(`<p class="q" id="sheetTitle">${KINDS[me.kind]}</p><img class="shot" src="${photo}" alt="आपकी खींची फोटो">
    <p class="note">चेहरे या गाड़ी का नंबर न दिखे, तो बेहतर। फोटो सबको दिखेगी।</p>
    <div class="row"><button class="btn main" id="send" type="button">📤 भेजो</button><button class="btn" id="again" type="button">दोबारा खींचो</button></div><p class="err" id="caseErr"></p>`);
  $('#again').addEventListener('click', () => { $('#camera').value = ''; $('#camera').click(); });
  $('#send').addEventListener('click', async () => {
    $('#send').disabled = true;
    $('#send').textContent = 'भेज रहे हैं…';
    try {
      const c = await call('/api/p/case', { kind: me.kind, photo });
      await refresh();
      showCase(c, true);
    } catch (err) { $('#caseErr').textContent = err.message; $('#send').disabled = false; $('#send').textContent = '📤 भेजो'; }
  });
});

function showCase(c, fresh) {
  open(`${fresh ? `<p class="q" id="sheetTitle">शिकायत दर्ज हो गई</p>` : `<p class="q" id="sheetTitle">${esc(KINDS[c.kind])}</p>`}
    <img class="shot" src="${esc(c.photo)}" alt="${esc(KINDS[c.kind])} की फोटो">
    <p>${esc(c.seatName)}, ${esc(c.district)}. 👥 <b>${c.confirms}</b> लोग · ${c.days ? `${c.days} दिन से` : 'आज'}${c.mla ? ` · विधायक: ${esc(c.mla)}` : ''}</p>
    ${fresh ? '<p>पड़ोसियों को भेजो। जितने ज़्यादा लोग "मेरे यहाँ भी" दबाएँगे, उतना ज़ोर पड़ेगा।</p>' : ''}
    <div class="row">
      <a class="btn wa" target="_blank" rel="noopener" href="${wa(`${KINDS[c.kind]}, ${c.seatName} (${c.district}): ${c.confirms} लोग परेशान। देखो और साथ दो: ${location.origin}/case/${c.id}`)}">WhatsApp पर भेजो</a>
      ${c.fixed ? '' : `<button class="btn" data-vote="confirm" data-id="${c.id}" type="button">👍 मेरे यहाँ भी</button><button class="btn" data-vote="fixed" data-id="${c.id}" type="button">✅ ठीक हो गया</button>`}
      <button class="btn" data-vote="flag" data-id="${c.id}" type="button">⚠️ गलत फोटो</button>
    </div>`);
}

// Start: a shared case link opens that case, a saved place opens straight to the tiles
const shared = location.pathname.match(/^\/case\/([0-9a-f]{12})$/);
const saved = JSON.parse(store.get('where') || 'null');
(async () => {
  if (saved) await setPlace(...saved).catch(() => {});
  if (shared) {
    try { showCase(await call(`/api/p/case/${shared[1]}`)); } catch { open('<p class="err">यह शिकायत अब नहीं है।</p>'); }
  }
})();
