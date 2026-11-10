// Vidhayak report card: what a sitting MLA declared in their own affidavit, set against the other MLAs.
// It states records and never grades, because a grade would be this site's opinion of a person.
import { rupeesCr } from './hisaab.js';

let cards;
export const loadCards = () => (cards ||= fetch('data/reportcards.json').then((r) => r.json()).catch(() => ({ mlas: {} })));
export const cardUrl = (kind, key) => `img/card/${kind}-${String(key).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`;

const num = (n) => n.toLocaleString('en-IN');
const row = (label, value, note = '') => `<div class="rc-row"><dt>${label}</dt><dd><b>${value}</b>${note ? `<small>${note}</small>` : ''}</dd></div>`;

export function reportCard({ s, seats, extra, esc, pName, mynetaUrl }) {
  const m = s.mla;
  if (m.vacant) return '<p class="lead">This seat is vacant. Wikipedia lists a bye-election as still to come.</p>';
  const all = Object.values(seats);
  const declared = all.map((x) => x.mla).filter((x) => x.cases != null);
  const x = extra || {};
  const rows = [];

  if (m.cases == null) {
    rows.push(row('Affidavit', 'Not in this data', `This MLA won a bye-election after 2022. <a href="${mynetaUrl()}" target="_blank" rel="noopener">Look them up on MyNeta</a>.`));
  } else {
    const withCases = declared.filter((d) => d.cases > 0).length;
    const fewer = declared.filter((d) => d.cases < m.cases).length;
    rows.push(row('Declared criminal cases', m.cases,
      m.cases ? `More than ${fewer} of the ${declared.length} MLAs with an affidavit here. ${withCases} of them declare at least one case.` : `${declared.length - withCases} of ${declared.length} MLAs declare none.`));
    if (x.charges?.length) {
      rows.push(`<div class="rc-row rc-wide"><dt>Charges named in those cases</dt><dd><ul class="rc-charges">${x.charges.slice(0, 6).map((c) => `<li>${esc(c.what)} <small>Section ${esc(c.section)}${c.n > 1 ? `, ${c.n} counts` : ''}</small></li>`).join('')}</ul>${x.charges.length > 6 ? `<small>And ${x.charges.length - 6} more on the affidavit.</small>` : ''}</dd></div>`);
    }
    // Said only when the affidavit's own conviction table reads "No Cases"
    if (m.cases && x.noConviction) rows.push(row('Convictions', 'None declared', 'A declared case is an accusation. The affidavit lists no conviction.'));

    if (m.assets != null) {
      const rich = declared.filter((d) => d.assets != null).sort((a, b) => b.assets - a.assets);
      rows.push(row('Declared assets', rupeesCr(m.assets), `Number ${rich.findIndex((d) => d.id === m.id) + 1} of ${rich.length} by wealth, with self, spouse and dependants counted together.`));
    }
    if (x.liabilities != null) rows.push(row('Loans and dues', x.liabilities ? rupeesCr(x.liabilities) : 'None declared'));
    if (x.income) rows.push(row('Income in last tax return', rupeesCr(x.income), 'Own return only, as written on the affidavit.'));
    const before = x.earlier?.find((e) => e.assets);
    if (before && m.assets) {
      const times = m.assets / before.assets;
      rows.push(row(`Assets in ${esc(before.where)}`, rupeesCr(before.assets), `${times >= 1.15 ? `The 2022 figure is ${times.toFixed(1)} times this.` : times <= 0.87 ? 'The 2022 figure is lower.' : 'About the same in 2022.'} MyNeta matched the two affidavits to one person. ${before.cases} declared ${before.cases === 1 ? 'case' : 'cases'} then.`));
    }
    const about = [m.edu, x.age ? `age ${x.age} in 2022` : '', x.job].filter(Boolean).map(esc).join(', ');
    if (about) rows.push(row('Education, age, work', about));
  }

  if (!m.bye) {
    const byMargin = [...all].sort((a, b) => b.margin - a.margin);
    const ofAll = (s.pct * s.turnout) / 100;
    rows.push(row('Won in 2022 by', `${num(s.margin)} votes`, `Number ${byMargin.findIndex((d) => d.no === s.no) + 1} of 403 by size of win.`));
    rows.push(row('Voters behind this MLA', `${s.pct}% of votes cast`, `Turnout was ${s.turnout}%, so about ${Math.round(ofAll)} of every 100 people on the voter list chose this MLA.`));
  }
  rows.push(row('MLA fund (Vidhayak Nidhi)', '₹5 crore a year', 'Raised from ₹3 crore in 2022. UP puts out no open record of how each MLA spends it. <a href="https://rtionline.up.gov.in/" target="_blank" rel="noopener">Ask by RTI</a> at your district development office.'));
  rows.push('<div class="rc-row" id="rcMp"></div>');

  return `<div class="rc-top">
      ${m.id ? `<img class="rc-photo" src="img/mla/${Number(m.id)}.jpg" width="120" height="150" alt="${esc(m.name)}, the photo from the 2022 affidavit">` : ''}
      <div><h3><a href="${mynetaUrl(m.id)}" target="_blank" rel="noopener">${esc(m.name)}</a></h3>
        <p class="lead">${esc(pName(m.party))}${m.bye ? ', won a bye-election after 2022' : ''}. MLA for ${esc(s.name)}.</p>
        <div class="rc-actions"><button class="action" id="rcShare" type="button">Share this report card</button>
          <a class="action ghost" href="${cardUrl('seat', s.no)}" download="${esc(s.name)}-report-card.jpg">Save the picture</a></div>
      </div>
    </div>
    <dl class="rc">${rows.join('')}</dl>
    <p class="muted">Everything here is the MLA's own sworn 2022 affidavit, collected by ADR on <a href="${mynetaUrl(m.id)}" target="_blank" rel="noopener">MyNeta</a>, plus the Election Commission's 2022 count. Nothing is this site's opinion. Found a mistake? <a href="https://github.com/faizdevx/Survive_UttarPradesh/issues/new?title=${encodeURIComponent(`Fix report card: ${s.name}`)}" target="_blank" rel="noopener">Report it</a>.</p>`;
}

export const mpLine = (mp, esc) => (mp
  ? `<dt>Your MP's fund (MPLADS)</dt><dd><b>${rupeesCr(mp.paid)} paid out</b><small>${esc(mp.mp)}, ${esc(mp.seat)}: ${mp.payments} payments so far, against ${rupeesCr(mp.rec.amt)} of work recommended. <a href="#ghoomo/hisaab">See Mera Hisaab</a>.</small></dd>`
  : '');
