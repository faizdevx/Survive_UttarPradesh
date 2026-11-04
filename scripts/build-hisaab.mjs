// Builds public/data/hisaab-budget.json (PRS analysis of the UP budget) and hisaab-mplads.json.
// Run with: node scripts/build-hisaab.mjs
import fs from 'node:fs';
import { fetchMplads } from './mplads-lib.mjs';

const PRS = 'https://prsindia.org/budgets/states/uttar-pradesh-budget-analysis-2026-27';
const html = (await (await fetch(PRS, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text()).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
const clean = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&rsquo;|&#39;/g, "'").replace(/\s+/g, ' ').trim();
const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/g)].map((m) => [...m[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].map((r) => [...r[0].matchAll(/<t[dh][\s\S]*?<\/t[dh]>/g)].map((c) => clean(c[0]))));
const num = (s) => { const n = Number(String(s).replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
const pct = (s) => { const n = Number(String(s).replace(/%/g, '')); return Number.isFinite(n) ? n : null; };

// A table is found by what its rows say, not by position, so a reshuffled page fails loudly
const find = (needle) => {
  const t = tables.find((rows) => rows.some((r) => r[0] === needle));
  if (!t) throw new Error(`PRS table with row "${needle}" not found`);
  return t;
};
const rowOf = (t, name) => {
  const r = t.find((x) => x[0] === name);
  if (!r) throw new Error(`PRS row "${name}" not found`);
  return r;
};
// Rows run: actuals, budgeted, revised, % change, budgeted next year, % change
const four = (r) => [num(r[1]), num(r[2]), num(r[3]), num(r[5])];

const main = find('Total Expenditure');
const spend = find('Revenue Expenditure');
const committed = find('Salaries');
const receipts = find("State's Own Tax");
const taxes = find('State GST');
const sectors = tables.find((rows) => rows[0][0] === 'Sector' && rows[0].length >= 7);
const capital = find('2021-22');
const beActualSector = tables.find((rows) => rows[0][0] === 'Sector' && rows[0].length === 4);
const beActualReceipts = find('Net Receipts (1+2)');
const beActualTax = tables.find((rows) => rows[0][0] === 'Head' && rows[0].length === 4);
if (!sectors || !beActualSector || !beActualTax) throw new Error('PRS sector tables not found');

const budget = {
  source: PRS,
  title: 'Uttar Pradesh Budget Analysis 2026-27, PRS Legislative Research',
  presented: clean(html).match(/presented the Budget[^.]*?on ([A-Z][a-z]+ \d{1,2}, \d{4})/)?.[1] || null,
  fetchedAt: new Date().toISOString(),
  unit: 'Rs crore',
  years: ['2024-25 actual', '2025-26 budget', '2025-26 revised', '2026-27 budget'],
  totals: { totalExpenditure: four(rowOf(main, 'Total Expenditure')), netExpenditure: four(rowOf(main, 'Net Expenditure (E)')) },
  split: { revenue: four(rowOf(spend, 'Revenue Expenditure')), capital: four(rowOf(spend, 'Capital Outlay')), loans: four(rowOf(spend, 'Loans given by the state')) },
  committed: ['Salaries', 'Pension', 'Interest'].map((n) => ({ name: n, vals: four(rowOf(committed, n)) })),
  sectors: sectors.slice(1).filter((r) => num(r[1]) != null && !r[0].startsWith('%')).map((r) => ({ name: r[0], vals: [num(r[1]), num(r[2]), num(r[3]), num(r[4])], note: r[6] || '' })),
  receipts: ["State's Own Tax", "State's Own Non-Tax", 'Share in Central Taxes', 'Grants from Centre'].map((n) => ({ name: n, vals: four(rowOf(receipts, n)) })),
  netReceipts: four(rowOf(receipts, 'Net Receipts')),
  ownTax: taxes.slice(1).filter((r) => num(r[1]) != null && !/total/i.test(r[0])).map((r) => ({ name: r[0], vals: four(r) })),
  promise: {
    capital: capital.filter((r) => /^\d{4}-\d{2}$/.test(r[0])).map((r) => ({ year: r[0], budget: num(r[1]), actual: num(r[2]), change: pct(r[3]) })),
    sectors2024: beActualSector.slice(1).filter((r) => num(r[1]) != null).map((r) => ({ name: r[0], budget: num(r[1]), actual: num(r[2]), change: pct(r[3]) })),
    receipts2024: beActualReceipts.filter((r) => num(r[1]) != null).map((r) => ({ name: r[0], budget: num(r[1]), actual: num(r[2]), change: pct(r[3]) })),
    tax2024: beActualTax.slice(1).filter((r) => num(r[1]) != null).map((r) => ({ name: r[0], budget: num(r[1]), actual: num(r[2]), change: pct(r[3]) })),
  },
};
fs.writeFileSync('public/data/hisaab-budget.json', JSON.stringify(budget));

const known = Object.keys(JSON.parse(fs.readFileSync('public/data/districts.json')));
const mp = await fetchMplads(known);
fs.writeFileSync('public/data/hisaab-mplads.json', JSON.stringify(mp));

// CAG lists every state's reports together, so UP's are picked out by title
const audit = [];
const seenReports = new Set();
let pagesRead = 0;
for (let page = 1; page <= 60; page += 1) {
  const r = await fetch(`https://cag.gov.in/en/audit-report?page=${page}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(40000) }).catch(() => null);
  if (!r?.ok) break;
  const cards = [...(await r.text()).matchAll(/href="(\/en\/audit-report\/details\/\d+)"[^>]*>([^<]{8,400})</g)];
  if (!cards.length) break;
  pagesRead += 1;
  cards.forEach(([, href, name]) => {
    const t = clean(name);
    if (/uttar pradesh/i.test(t) && !seenReports.has(href)) { seenReports.add(href); audit.push({ title: t, url: `https://cag.gov.in${href}` }); }
  });
  await new Promise((x) => setTimeout(x, 700));
}
fs.writeFileSync('public/data/hisaab-audit.json', JSON.stringify({ fetchedAt: new Date().toISOString(), source: 'https://cag.gov.in/en/audit-report', pagesRead, reports: audit }));

const cr = (n) => `${(n / 1e7).toFixed(1)} cr`;
Object.entries(mp.houses).forEach(([h, t]) => console.log(h, { members: t.members, rows: t.rows, rec: [t.recommended.n, cr(t.recommended.amt)], san: [t.sanctioned.n, cr(t.sanctioned.amt)], done: [t.completed.n, cr(t.completed.amt)], paid: cr(t.paid), inProgress: cr(t.inProgress), dates: [t.firstDate, t.lastDate] }));
console.log({ districts: Object.keys(mp.districts).length, missing: known.filter((d) => !mp.districts[d]) });
const blob = fs.readFileSync('public/data/hisaab-mplads.json', 'utf8');
console.log({ bytes: blob.length, phoneLike: (blob.match(/\b[6-9]\d{9}\b/g) || []).length, descriptionField: /WORK_DESCRIPTION|VENDOR_/.test(blob) });
console.log('firms sample', mp.seats.flatMap((s) => s.firms.map((x) => x[0])).slice(0, 6));
console.log({ auditPages: pagesRead, auditReports: audit.length, sample: audit.slice(0, 3).map((a) => a.title.slice(0, 70)) });
