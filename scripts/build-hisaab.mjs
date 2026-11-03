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

const cr = (n) => `${(n / 1e7).toFixed(1)} cr`;
console.log({ presented: budget.presented, net: budget.totals.netExpenditure, sectors: budget.sectors.length, capital: budget.promise.capital, sectors2024: budget.promise.sectors2024.length, receipts: budget.receipts.map((r) => r.vals[3]), ownTax: budget.ownTax.map((x) => x.name) });
console.log(budget.sectors.map((s) => `${s.name}: ${s.vals.join(', ')}`).join('\n'));
console.log(budget.promise.sectors2024.slice(0, 6).map((s) => `${s.name} ${s.budget}>${s.actual} ${s.change}%`).join(' | '));
console.log({ rows: mp.rows, seats: mp.seats.length, paid: cr(mp.paid), inProgress: cr(mp.inProgress), dates: [mp.firstDate, mp.lastDate], tenures: mp.tenures, districts: Object.keys(mp.districts).length, missingDistricts: known.filter((d) => !mp.districts[d]), unmatched: mp.unmatched });
console.log('top', mp.seats.slice(0, 3).map((s) => `${s.seat} ${cr(s.paid)} ${s.works} works`), 'bottom', mp.seats.slice(-3).map((s) => `${s.seat} ${cr(s.paid)}`));
console.log('bytes', fs.statSync('public/data/hisaab-mplads.json').size, fs.statSync('public/data/hisaab-budget.json').size);
const blob = fs.readFileSync('public/data/hisaab-mplads.json', 'utf8');
console.log('contractor fields in output:', /VENDOR/i.test(blob));
