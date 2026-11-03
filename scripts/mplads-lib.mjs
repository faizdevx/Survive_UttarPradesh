// Fetches UP's public MPLADS payment records and sums them by seat and district.
// Contractor fields are dropped here on purpose: many are private individuals.
const URL = 'https://mplads.mospi.gov.in/rest/PreLoginDashboardData/getTilesReportData';
const UP_STATE_ID = 33;
const LOK_SABHA = 2;

const DISTRICT_ALIAS = {
  'BARA BANKI': 'Barabanki', KHERI: 'Lakhimpur Kheri', 'LAKHIMPUR KHERI': 'Lakhimpur Kheri', ALLAHABAD: 'Prayagraj', FAIZABAD: 'Ayodhya', BAGPAT: 'Baghpat', BADAUN: 'Budaun', BUDAUN: 'Budaun',
  'GAUTAM BUDH NAGAR': 'Gautam Buddha Nagar', 'GAUTAM BUDDHA NAGAR': 'Gautam Buddha Nagar', 'G B NAGAR': 'Gautam Buddha Nagar', 'GB NAGAR': 'Gautam Buddha Nagar', 'RAE BARELI': 'Rae Bareli', RAEBARELI: 'Rae Bareli',
  SHRAVASTI: 'Shrawasti', MAHRAJGANJ: 'Maharajganj', 'SIDDHARTH NAGAR': 'Siddharthnagar', 'KUSHI NAGAR': 'Kushinagar', 'SANT RAVIDAS NAGAR': 'Bhadohi', 'SANT RAVIDAS NAGAR BHADOHI': 'Bhadohi',
  'JYOTIBA PHULE NAGAR': 'Amroha', BALIA: 'Ballia', BULANDSAHAR: 'Bulandshahr', 'KANSHIRAM NAGAR': 'Kasganj', 'MAHAMAYA NAGAR': 'Hathras', KANPUR: 'Kanpur Nagar',
  'SANT KABEER NAGAR': 'Sant Kabir Nagar', 'AMBEDKAR NAGAR': 'Ambedkar Nagar', SITAPUR: 'Sitapur',
};
const title = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function districtOf(ida, known) {
  const raw = String(ida || '').split('(')[0].replace(/[^A-Za-z ]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  const name = DISTRICT_ALIAS[raw] || title(raw);
  return known.has(name) ? name : null;
}
const isoDate = (s) => {
  const t = new Date(String(s || '').replace(/-/g, ' '));
  return Number.isNaN(+t) ? null : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

export async function fetchMplads(knownDistricts) {
  const r = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': 'SurviveUP/0.1 (github.com/faizdevx/Survive_UttarPradesh)' },
    body: JSON.stringify({ combo: `${UP_STATE_ID},0,0,${LOK_SABHA}`, key: 'Expenditure on Completed and On-going Works as on Date' }),
    signal: AbortSignal.timeout(180000),
  });
  if (!r.ok) throw new Error(`mplads.mospi.gov.in answered ${r.status}`);
  const rows = JSON.parse((await r.json())['Total Expenditure']).filter((x) => x.WORK_RECOMMENDATION_DTL_ID && x.STATE_NAME === 'Uttar Pradesh');
  if (rows.length < 1000) throw new Error(`only ${rows.length} rows, expected far more`);

  const known = new Set(knownDistricts);
  const seats = {};
  const districts = {};
  const unmatched = {};
  const tenures = new Set();
  rows.forEach((x) => {
    const amount = Number(x.FUND_DISBURSED_AMT) || 0;
    const done = x.WORK_STATUS === 'Payment Success';
    const date = isoDate(x.EXPENDITURE_DATE);
    tenures.add(x.TENURE);
    const seatName = title(String(x.CONSTITUENCY || 'Unknown').replace(/\(.*?\)/g, '').trim());
    const s = (seats[seatName] ||= { seat: seatName, mp: title(String(x.MP_NAME || '').trim()), paid: 0, inProgress: 0, payments: 0, workIds: new Set(), last: null, kinds: {}, works: {}, districts: new Set() });
    s.payments += 1;
    s.workIds.add(x.WORK_RECOMMENDATION_DTL_ID);
    if (done) s.paid += amount; else s.inProgress += amount;
    if (date && (!s.last || date > s.last)) s.last = date;
    const kind = String(x.ACTIVITY_NAME || 'Not stated').replace(/^\d+(\.\d+)?\s*/, '').trim();
    s.kinds[kind] = (s.kinds[kind] || 0) + amount;
    const w = (s.works[x.WORK_RECOMMENDATION_DTL_ID] ||= { id: x.WORK_ID, kind, agency: String(x.IA_NAME || '').trim(), amount: 0, date, pending: false });
    w.amount += amount;
    if (date && (!w.date || date > w.date)) w.date = date;
    if (!done) w.pending = true;

    const d = districtOf(x.IDA_NAME, known);
    if (!d) { unmatched[x.IDA_NAME] = (unmatched[x.IDA_NAME] || 0) + 1; return; }
    s.districts.add(d);
    const dd = (districts[d] ||= { paid: 0, inProgress: 0, workIds: new Set(), seats: new Set() });
    if (done) dd.paid += amount; else dd.inProgress += amount;
    dd.workIds.add(x.WORK_RECOMMENDATION_DTL_ID);
    dd.seats.add(seatName);
  });

  const outSeats = Object.values(seats).map((s) => ({
    seat: s.seat, mp: s.mp, paid: Math.round(s.paid), inProgress: Math.round(s.inProgress), payments: s.payments, works: s.workIds.size, last: s.last,
    districts: [...s.districts],
    kinds: Object.entries(s.kinds).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => [k, Math.round(v)]),
    top: Object.values(s.works).sort((a, b) => b.amount - a.amount).slice(0, 6).map((w) => ({ ...w, amount: Math.round(w.amount) })),
  })).sort((a, b) => b.paid - a.paid);
  const outDistricts = Object.fromEntries(Object.entries(districts).map(([k, d]) => [k, { paid: Math.round(d.paid), inProgress: Math.round(d.inProgress), works: d.workIds.size, seats: [...d.seats] }]));
  const dates = rows.map((x) => isoDate(x.EXPENDITURE_DATE)).filter(Boolean).sort();
  return {
    fetchedAt: new Date().toISOString(),
    source: 'https://mplads.mospi.gov.in/',
    scope: 'Uttar Pradesh, Lok Sabha members, default public report',
    tenures: [...tenures],
    firstDate: dates[0],
    lastDate: dates[dates.length - 1],
    rows: rows.length,
    paid: outSeats.reduce((a, s) => a + s.paid, 0),
    inProgress: outSeats.reduce((a, s) => a + s.inProgress, 0),
    seats: outSeats,
    districts: outDistricts,
    unmatched,
  };
}
