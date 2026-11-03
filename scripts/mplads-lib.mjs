// Fetches UP's public MPLADS reports for both Houses and sums them by member and district.
// Work descriptions never leave this file: they can hold citizens' names and mobile numbers.
// Contractor names are kept only when the name is clearly a business.
const URL = 'https://mplads.mospi.gov.in/rest/PreLoginDashboardData/getTilesReportData';
const UP_STATE_ID = 33;
const REPORTS = {
  paid: 'Expenditure on Completed and On-going Works as on Date',
  recommended: 'Works Recommended',
  sanctioned: 'Works Sanctioned',
  completed: 'Works Completed',
};

const DISTRICT_ALIAS = {
  'BARA BANKI': 'Barabanki', KHERI: 'Lakhimpur Kheri', 'LAKHIMPUR KHERI': 'Lakhimpur Kheri', ALLAHABAD: 'Prayagraj', FAIZABAD: 'Ayodhya', BAGPAT: 'Baghpat', BADAUN: 'Budaun', BUDAUN: 'Budaun',
  'GAUTAM BUDH NAGAR': 'Gautam Buddha Nagar', 'GAUTAM BUDDHA NAGAR': 'Gautam Buddha Nagar', 'G B NAGAR': 'Gautam Buddha Nagar', 'GB NAGAR': 'Gautam Buddha Nagar', 'RAE BARELI': 'Rae Bareli', RAEBARELI: 'Rae Bareli',
  SHRAVASTI: 'Shrawasti', MAHRAJGANJ: 'Maharajganj', 'SIDDHARTH NAGAR': 'Siddharthnagar', 'KUSHI NAGAR': 'Kushinagar', 'SANT RAVIDAS NAGAR': 'Bhadohi', 'SANT RAVIDAS NAGAR BHADOHI': 'Bhadohi',
  'JYOTIBA PHULE NAGAR': 'Amroha', BALIA: 'Ballia', BULANDSAHAR: 'Bulandshahr', 'KANSHIRAM NAGAR': 'Kasganj', 'MAHAMAYA NAGAR': 'Hathras', KANPUR: 'Kanpur Nagar',
  'SANT KABEER NAGAR': 'Sant Kabir Nagar', 'AMBEDKAR NAGAR': 'Ambedkar Nagar',
};
const BUSINESS = /\b(ltd|limited|pvt|private|llp|nigam|corporation|corpn|federation|co-?operative|society|enterprises?|constructions?|builders?|traders?|infra\w*|industries|electricals?|solar|technolog\w+|associates|company|developers?|engineers?|engineering|agency|agencies)\b/i;
const title = (s) => String(s || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const cleanMember = (s) => title(String(s || '').replace(/\(.*?\)/g, '').replace(/^\s*(shri|smt\.?|dr\.?|prof\.?|sh\.?|sri)\s+/i, '').trim());
const kindOf = (s) => String(s || 'Not stated').replace(/^WS\/[^-]*-/, '').replace(/^\d+(\.\d+)?\s*/, '').trim();

function districtOf(ida, known) {
  const raw = String(ida || '').split('(')[0].replace(/[^A-Za-z ]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  const name = DISTRICT_ALIAS[raw] || title(raw);
  return known.has(name) ? name : null;
}
const isoDate = (s) => {
  const t = new Date(String(s || '').replace(/-/g, ' '));
  return Number.isNaN(+t) ? null : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

async function report(house, key) {
  const r = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': 'SurviveUP/0.1 (github.com/faizdevx/Survive_UttarPradesh)' },
    body: JSON.stringify({ combo: `${UP_STATE_ID},0,0,${house}`, key }),
    signal: AbortSignal.timeout(240000),
  });
  if (!r.ok) throw new Error(`mplads.mospi.gov.in answered ${r.status}`);
  const top = await r.json();
  return JSON.parse(Object.values(top)[0]).filter((x) => x.STATE_NAME === 'Uttar Pradesh' && x.WORK_RECOMMENDATION_DTL_ID);
}

function summarise(data, house, known) {
  const isLok = house === 2;
  const members = {};
  const member = (x) => {
    const id = isLok ? title(String(x.CONSTITUENCY || 'Unknown').replace(/\(.*?\)/g, '').trim()) : cleanMember(x.MP_NAME);
    return (members[id] ||= {
      seat: id, mp: cleanMember(x.MP_NAME), house: isLok ? 'Lok Sabha' : 'Rajya Sabha', paid: 0, inProgress: 0, payments: 0, last: null,
      rec: { n: 0, amt: 0 }, san: { n: 0, amt: 0 }, done: { n: 0, amt: 0 }, kinds: {}, works: {}, firms: {}, doneWorks: [], districts: new Set(),
    });
  };
  const districts = {};
  const district = (x) => {
    const d = districtOf(x.IDA_NAME, known);
    return d ? (districts[d] ||= { paid: 0, inProgress: 0, works: new Set(), done: 0, doneAmt: 0, san: 0, seats: new Set() }) : null;
  };
  const dates = [];

  data.paid.forEach((x) => {
    const m = member(x);
    const amount = Number(x.FUND_DISBURSED_AMT) || 0;
    const ok = x.WORK_STATUS === 'Payment Success';
    const date = isoDate(x.EXPENDITURE_DATE);
    if (date) dates.push(date);
    m.payments += 1;
    if (ok) m.paid += amount; else m.inProgress += amount;
    if (date && (!m.last || date > m.last)) m.last = date;
    const kind = kindOf(x.ACTIVITY_NAME);
    m.kinds[kind] = (m.kinds[kind] || 0) + amount;
    const w = (m.works[x.WORK_RECOMMENDATION_DTL_ID] ||= { id: x.WORK_ID, kind, agency: String(x.IA_NAME || '').replace(/d{10,}/g, '').trim(), amount: 0, date, pending: false });
    w.amount += amount;
    if (date && (!w.date || date > w.date)) w.date = date;
    if (!ok) w.pending = true;
    const firm = String(x.VENDOR_NAME || '').replace(/[\d]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (BUSINESS.test(firm)) m.firms[firm] = (m.firms[firm] || 0) + amount;
    const d = district(x);
    if (d) {
      if (ok) d.paid += amount; else d.inProgress += amount;
      d.works.add(x.WORK_RECOMMENDATION_DTL_ID);
      d.seats.add(m.seat);
      m.districts.add(districtOf(x.IDA_NAME, known));
    }
  });
  data.recommended.forEach((x) => { const m = member(x); m.rec.n += 1; m.rec.amt += Number(x.RECOMMENDED_AMOUNT) || 0; });
  data.sanctioned.forEach((x) => {
    const m = member(x);
    m.san.n += 1;
    m.san.amt += Number(x.SANCTION_AMOUNT) || 0;
    const d = district(x);
    if (d) d.san += 1;
  });
  data.completed.forEach((x) => {
    const m = member(x);
    const amount = Number(x.ACTUAL_AMOUNT) || 0;
    m.done.n += 1;
    m.done.amt += amount;
    m.doneWorks.push({ id: x.WORK_ID, kind: kindOf(x.ACTIVITY_NAME), amount, date: isoDate(x.ACTUAL_END_DATE) });
    const d = district(x);
    if (d) { d.done += 1; d.doneAmt += amount; }
  });

  const list = Object.values(members).map((m) => ({
    seat: m.seat, mp: m.mp, house: m.house, paid: Math.round(m.paid), inProgress: Math.round(m.inProgress), payments: m.payments, last: m.last,
    rec: { n: m.rec.n, amt: Math.round(m.rec.amt) }, san: { n: m.san.n, amt: Math.round(m.san.amt) }, done: { n: m.done.n, amt: Math.round(m.done.amt) },
    districts: [...m.districts],
    kinds: Object.entries(m.kinds).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => [k, Math.round(v)]),
    top: Object.values(m.works).sort((a, b) => b.amount - a.amount).slice(0, 5).map((w) => ({ ...w, amount: Math.round(w.amount) })),
    topDone: m.doneWorks.sort((a, b) => b.amount - a.amount).slice(0, 5).map((w) => ({ ...w, amount: Math.round(w.amount) })),
    firms: Object.entries(m.firms).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => [k, Math.round(v)]),
  }));
  const sum = (f) => list.reduce((a, m) => a + f(m), 0);
  dates.sort();
  return {
    members: list,
    districts,
    totals: {
      members: list.length, rows: data.paid.length, firstDate: dates[0] || null, lastDate: dates[dates.length - 1] || null,
      recommended: { n: sum((m) => m.rec.n), amt: sum((m) => m.rec.amt) }, sanctioned: { n: sum((m) => m.san.n), amt: sum((m) => m.san.amt) }, completed: { n: sum((m) => m.done.n), amt: sum((m) => m.done.amt) },
      paid: sum((m) => m.paid), inProgress: sum((m) => m.inProgress),
    },
  };
}

export async function fetchMplads(knownDistricts) {
  const known = new Set(knownDistricts);
  const out = { fetchedAt: new Date().toISOString(), source: 'https://mplads.mospi.gov.in/', houses: {}, seats: [], districts: {} };
  const merged = {};
  for (const [house, label] of [[2, 'Lok Sabha'], [1, 'Rajya Sabha']]) {
    const data = {};
    for (const [name, key] of Object.entries(REPORTS)) data[name] = await report(house, key);
    if (data.paid.length < 500) throw new Error(`${label}: only ${data.paid.length} payment rows`);
    const s = summarise(data, house, known);
    out.houses[label] = s.totals;
    out.seats.push(...s.members);
    Object.entries(s.districts).forEach(([k, d]) => {
      const m = (merged[k] ||= { paid: 0, inProgress: 0, works: 0, done: 0, doneAmt: 0, san: 0, seats: new Set() });
      m.paid += d.paid; m.inProgress += d.inProgress; m.works += d.works.size; m.done += d.done; m.doneAmt += d.doneAmt; m.san += d.san;
      d.seats.forEach((x) => m.seats.add(x));
    });
  }
  out.districts = Object.fromEntries(Object.entries(merged).map(([k, d]) => [k, { ...d, paid: Math.round(d.paid), inProgress: Math.round(d.inProgress), doneAmt: Math.round(d.doneAmt), seats: [...d.seats] }]));
  return out;
}

// The tender portal's public home list. Its search sits behind a captcha, and this never touches it.
export async function fetchTenders() {
  const r = await fetch('https://etender.up.nic.in/nicgep/app', { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`etender.up.nic.in answered ${r.status}`);
  const html = await r.text();
  const clean = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const list = [...html.matchAll(/<tr[^>]*id="informal[^"]*"[\s\S]*?<\/tr>/g)].map((m) => [...m[0].matchAll(/<td[\s\S]*?<\/td>/g)].map((c) => clean(c[0])))
    .filter((c) => c.length >= 4).map((c) => ({ title: c[0].replace(/^\d+\.\s*/, ''), ref: c[1], closes: c[2], opens: c[3] }));
  // An empty answer is the portal having trouble, and must not read as "no tenders in UP"
  if (!list.length) throw new Error('the tender portal sent back no list');
  return list;
}
