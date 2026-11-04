// Mera Hisaab: where UP's money goes, one kind of evidence at a time.
// The stage rule comes from the Hisaab project: a budget is not a payment, a payment is not a finished work,
// and amounts from different stages are never added together. A missing record is shown as missing.
import { PROJECTS, MONEY_LINKS } from './content.js';
import { EVIDENCE } from './hisaab-evidence.js';

const STAGES = [
  { key: 'promised', label: 'Promised', help: 'A budget figure. Money the state plans to spend.' },
  { key: 'revised', label: 'Revised', help: "The state's own later estimate for that year." },
  { key: 'spent', label: 'Spent', help: 'Actuals reported in state accounts. Not checked work by work.' },
  { key: 'recommended', label: 'Recommended', help: 'An MP asked for this work. No money has moved yet.' },
  { key: 'sanctioned', label: 'Sanctioned', help: 'The district approved the work and its amount.' },
  { key: 'tender', label: 'Tender', help: 'Bids invited. Nobody has been paid, and the work may not go ahead.' },
  { key: 'paid', label: 'Paid', help: 'A payment recorded on a government portal. On its own, it does not prove the work is finished.' },
  { key: 'pending', label: 'Payment in progress', help: 'Started on the portal, not yet marked as paid.' },
  { key: 'completed', label: 'Marked complete', help: 'The portal says the work is finished. Nobody independent has checked it here.' },
  { key: 'reported', label: 'Reported', help: 'Named in press or on Wikipedia, not on a government page.' },
  { key: 'official', label: 'Official page', help: 'Stated on a government website. It is still the government describing its own work.' },
  { key: 'differ', label: 'Sources differ', help: 'Different sources give different figures. Read them before quoting one.' },
  { key: 'none', label: 'No record linked', help: 'We have not found a public record. This does not mean nothing happened.' },
];
const YEAR_STAGE = ['spent', 'promised', 'revised', 'promised'];
const COLOURS = ['#d3201f', '#f28a0f', '#1e7f3a', '#1c8fd6', '#8c5ac8', '#12a5a0', '#b5651d', '#e0569b', '#5a6b2a', '#8f8b80'];
const BINS = [{ max: 5e7, color: '#d9efd6', label: 'Under ₹5 cr' }, { max: 1e8, color: '#9fd59a', label: '₹5 to 10 cr' }, { max: 2e8, color: '#4fae5c', label: '₹10 to 20 cr' }, { max: Infinity, color: '#14662f', label: '₹20 cr and up' }];
const NONE_COLOUR = '#777';
const GUIDELINES = 'https://tnrd.tn.gov.in/project/go_files/4_88888_2016_MPLADS2016.pdf';

export const rupeesCr = (rupees) => (rupees >= 1e7 ? `₹${(rupees / 1e7).toLocaleString('en-IN', { maximumFractionDigits: 1 })} cr` : `₹${(rupees / 1e5).toLocaleString('en-IN', { maximumFractionDigits: 1 })} lakh`);
const crore = (n) => (n >= 1e5 ? `₹${(n / 1e5).toFixed(2)} lakh cr` : `₹${n.toLocaleString('en-IN')} cr`);
const longDate = (iso) => (iso ? new Date(`${iso}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'date not given');
const count = (n) => Number(n).toLocaleString('en-IN');

const once = (load) => {
  let pending = null;
  return () => {
    pending ||= load().catch((err) => { pending = null; throw err; });
    return pending;
  };
};
const getJson = async (url) => {
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error);
  return j;
};
export const loadMplads = once(() => getJson('/api/mplads'));
export const loadTenders = once(() => getJson('/api/tenders'));
const loadBudget = once(() => getJson('data/hisaab-budget.json'));
const loadAudit = once(() => getJson('data/hisaab-audit.json'));

export function initHisaab(ctx) {
  const { $, esc, state, store, keepMapClear, openCity } = ctx;
  const stageChip = (key) => {
    const s = STAGES.find((x) => x.key === key);
    return `<span class="stage stage-${key}" title="${esc(s.help)}">${esc(s.label)}</span>`;
  };
  const bars = (rows) => {
    const top = Math.max(...rows.map((r) => r.value), 1);
    return `<div class="h-bars">${rows.map((r) => `<div class="h-bar"><span class="h-name">${esc(r.name)}</span><span class="h-track"><i style="width:${(100 * r.value) / top}%;background:${r.color || '#d3201f'}"></i></span><b>${esc(r.text)}</b></div>`).join('')}</div>`;
  };
  // One work moving through the stages. The steps overlap, so they must never be added up.
  const funnel = (f) => `<ol class="funnel">
    <li>${stageChip('recommended')}<b>${count(f.rec.n)} works</b><span>${rupeesCr(f.rec.amt)}</span></li>
    <li>${stageChip('sanctioned')}<b>${count(f.san.n)} works</b><span>${rupeesCr(f.san.amt)}</span></li>
    <li>${stageChip('completed')}<b>${count(f.done.n)} works</b><span>${rupeesCr(f.done.amt)}</span></li>
    <li>${stageChip('paid')}<b>${rupeesCr(f.paid)}</b><span>${stageChip('pending')} ${rupeesCr(f.inProgress)}</span></li></ol>`;

  /* Tera ₹100 */
  function hundred(el, b) {
    let year = 0;
    let taxPaid = store.get('taxPaid') || '';
    const paint = () => {
      const net = b.totals.netExpenditure[year];
      const named = b.sectors.map((s, i) => ({ name: s.name, value: s.vals[year], color: COLOURS[i], note: s.note }));
      const rest = net - named.reduce((a, s) => a + s.value, 0);
      const all = [...named, { name: 'Everything else, including debt interest and pensions', value: rest, color: COLOURS[9], note: '' }];
      const inTotal = b.receipts.map((r) => r.vals[year]).reduce((a, c) => a + c, 0);
      const amount = Number(taxPaid) || 0;
      $('#h100Body', el).innerHTML = `
        <p class="h-stage-line">${stageChip(YEAR_STAGE[year])} ${esc(b.years[year])}: <b>${crore(net)}</b> net expenditure</p>
        <h3>Every ₹100 the state plans or spends goes here</h3>
        <div class="h-stack" role="img" aria-label="Share of spending by sector">${all.map((s) => `<i style="width:${(100 * s.value) / net}%;background:${s.color}" title="${esc(s.name)}"></i>`).join('')}</div>
        ${bars(all.map((s) => ({ name: s.name, value: s.value, color: s.color, text: `₹${((100 * s.value) / net).toFixed(1)}` })))}
        <h3>Your share of it</h3>
        <label class="g-label" for="taxInput">Tax you paid, in rupees</label>
        <input id="taxInput" inputmode="numeric" value="${esc(taxPaid)}" placeholder="50000" autocomplete="off">
        <div id="taxSplit">${amount ? bars(all.map((s) => ({ name: s.name, value: s.value, color: s.color, text: `₹${Math.round((amount * s.value) / net).toLocaleString('en-IN')}` }))) : ''}</div>
        <p class="muted">This is an illustration using budget shares. Tax goes into one pool before it is spent, so no record anywhere can follow your own rupees to a project. Income tax goes to the Centre first, and UP gets a share of the pool. Your number stays in this browser.</p>
        <h3>Where the money comes from</h3>
        ${bars(b.receipts.map((r, i) => ({ name: r.name, value: r.vals[year], color: COLOURS[(i + 3) % 9], text: `₹${((100 * r.vals[year]) / inTotal).toFixed(1)}` })))}
        <p class="muted">Share of net receipts, out of ₹100. Borrowing is separate and fills the gap.</p>
        <h3>Biggest taxes UP collects itself</h3>
        ${bars(b.ownTax.slice(0, 5).map((t) => ({ name: t.name, value: t.vals[year], color: COLOURS[1], text: crore(t.vals[year]) })))}
        <h3>Fixed bills</h3>
        ${bars(b.committed.map((c) => ({ name: c.name, value: c.vals[year], color: COLOURS[4], text: crore(c.vals[year]) })))}
        <p class="muted">Salaries, pensions and interest are counted across sectors, so never add these to the bars above.</p>`;
      $('#taxInput', el).addEventListener('input', (e) => {
        taxPaid = e.target.value.replace(/\D/g, '').slice(0, 12);
        e.target.value = taxPaid;
        store.set('taxPaid', taxPaid);
        const n = Number(taxPaid) || 0;
        $('#taxSplit', el).innerHTML = n ? bars(all.map((s) => ({ name: s.name, value: s.value, color: s.color, text: `₹${Math.round((n * s.value) / net).toLocaleString('en-IN')}` }))) : '';
      });
      el.querySelectorAll('[data-year]').forEach((x) => x.setAttribute('aria-pressed', Number(x.dataset.year) === year));
    };
    el.innerHTML = `<div class="tags">${b.years.map((y, i) => `<button data-year="${i}" aria-pressed="${i === year}"><span>${esc(y)}</span></button>`).join('')}</div><div id="h100Body"></div>`;
    el.querySelectorAll('[data-year]').forEach((x) => x.addEventListener('click', () => { year = Number(x.dataset.year); paint(); }));
    paint();
  }

  /* Vaada vs Asli */
  function promise(el, b) {
    const pair = (r) => {
      const top = Math.max(r.budget, r.actual);
      const short = r.change < 0;
      return `<div class="h-pair"><div class="h-pair-head"><b>${esc(r.name || r.year)}</b><span class="h-change ${short ? 'short' : 'over'}">${r.change > 0 ? '+' : ''}${r.change}%</span></div>
        <div class="h-pair-row">${stageChip('promised')}<span class="h-track"><i style="width:${(100 * r.budget) / top}%;background:#8f8b80"></i></span><b>${crore(r.budget)}</b></div>
        <div class="h-pair-row">${stageChip('spent')}<span class="h-track"><i style="width:${(100 * r.actual) / top}%;background:${short ? '#d3201f' : '#1e7f3a'}"></i></span><b>${crore(r.actual)}</b></div></div>`;
    };
    const worst = [...b.promise.sectors2024].sort((x, y) => x.change - y.change)[0];
    const capWorst = [...b.promise.capital].sort((x, y) => x.change - y.change)[0];
    el.innerHTML = `<p class="k-head">In ${esc(capWorst.year)}, ${Math.abs(capWorst.change)}% of the money promised for building things was not spent.</p>
      <p class="lead">Capital outlay pays for roads, bridges and buildings. It came in under budget in all four years PRS compares. In 2024-25 the biggest shortfall of the sectors listed was ${esc(worst.name)}, at ${worst.change}%.</p>
      <h3>Building money, promised and spent</h3>${b.promise.capital.map(pair).join('')}
      <h3>2024-25, sector by sector</h3>${[...b.promise.sectors2024].sort((x, y) => x.change - y.change).map(pair).join('')}
      <h3>2024-25, money that was expected to come in</h3>${b.promise.tax2024.map(pair).join('')}
      <p class="muted">Spending less than budgeted is not automatically waste, since it can mean savings, delays or less money coming in. These figures alone do not say which. Source: <a href="${esc(b.source)}" target="_blank" rel="noopener">PRS</a>.</p>`;
  }

  /* MP ka khata */
  async function khata(el) {
    el.innerHTML = 'Loading the portal records…';
    let data;
    try { data = await loadMplads(); } catch (err) {
      el.innerHTML = `<p class="empty">Could not load MP fund records: ${esc(err.message)}. Try again in a minute, or <a href="https://mplads.mospi.gov.in/" target="_blank" rel="noopener">open the portal</a>.</p>`;
      return;
    }
    if (!el.isConnected) return;
    let house = 'Lok Sabha';
    let filter = '';
    let sort = 'name';
    let picked = null;
    state.overlay = {
      fill: (name) => {
        const d = data.districts[name];
        return d ? BINS.find((x) => d.paid + d.inProgress < x.max).color : NONE_COLOUR;
      },
      strong: () => true,
      tip: (name) => {
        const d = data.districts[name];
        return `<b>${esc(name)}</b>${d ? `Paid ${rupeesCr(d.paid)}<br>${count(d.done)} works marked complete` : 'No MP fund payment found here yet'}`;
      },
      click: (name) => {
        filter = name;
        $('#seatFilter', el).value = name;
        paintList();
        el.querySelector('#seatList')?.scrollIntoView({ block: 'nearest' });
      },
    };
    state.layer.setStyle(ctx.style);
    keepMapClear(state.layer.getBounds());

    const houseTotals = (h) => {
      const t = data.houses[h];
      return { rec: t.recommended, san: t.sanctioned, done: t.completed, paid: t.paid, inProgress: t.inProgress };
    };
    el.innerHTML = `<div class="tags"><button data-house="Lok Sabha" aria-pressed="true"><span>Lok Sabha</span></button><button data-house="Rajya Sabha" aria-pressed="false"><span>Rajya Sabha</span></button></div>
      <div id="houseBody"></div>
      <div class="k-legend">${BINS.map((x) => `<span><i style="background:${x.color}"></i>${esc(x.label)}</span>`).join('')}<span><i style="background:${NONE_COLOUR}"></i>None found</span></div>
      <p class="muted">The map shows payments in each district from both Houses. Tap a district, or search below. It shows where the work was run, and one MP can reach several districts.</p>
      <div class="lookup"><input id="seatFilter" aria-label="Search by seat, MP or district" placeholder="Seat, MP or district"></div>
      <div class="tags"><button data-sort="name" aria-pressed="true"><span>A to Z</span></button><button data-sort="paid" aria-pressed="false"><span>Most paid</span></button></div>
      <div id="seatList"></div><div id="seatCard"></div>
      <h3>Reading this fairly</h3>
      <p class="muted">This is not a ranking of MPs. The money goes to the district, not to the MP: <a href="${GUIDELINES}" target="_blank" rel="noopener">the scheme guidelines (2016 edition)</a> set ₹5 crore a year per seat, paid in two parts, and unspent money carries over. A low figure can mean works are still moving through the steps, or a later start in a term. Rajya Sabha members' terms also differ.</p>
      <p class="muted">Only sitting members are in this public report. For earlier terms, the portal's public report offers no way to pull them, so they are not here. Work descriptions are left out because some hold citizens' phone numbers. Contractors appear only when the name is clearly a business.</p>`;

    function paintHouse() {
      const t = data.houses[house];
      const seen = data.seats.filter((s) => s.house === house).length;
      $('#houseBody', el).innerHTML = `<p class="k-head">${count(t.completed.n)} of ${count(t.recommended.n)} works recommended by UP's ${esc(house)} members are marked complete</p>
        ${funnel(houseTotals(house))}
        <p class="muted">${count(seen)} members. ${count(t.rows)} payment records, ${esc(longDate(t.firstDate))} to ${esc(longDate(t.lastDate))}. Refreshed ${esc(longDate(data.fetchedAt.slice(0, 10)))}. These steps overlap, since it is the same work moving along, so never add them up.</p>`;
    }
    function paintCard() {
      const s = data.seats.find((x) => x.seat === picked && x.house === house);
      const card = $('#seatCard', el);
      if (!s) { card.innerHTML = ''; return; }
      card.innerHTML = `<div class="k-card" id="seatCardInner"><h3>${esc(s.seat)}</h3><b>${esc(s.mp)}</b>, ${esc(s.house)}
        ${funnel(s)}
        <p class="muted">${count(s.payments)} payments. Latest ${esc(longDate(s.last))}. Districts: ${esc(s.districts.join(', ') || 'not matched')}.</p>
        <h3>What it went on</h3>${s.kinds.length ? bars(s.kinds.map(([k, v], i) => ({ name: k, value: v, color: COLOURS[i], text: rupeesCr(v) }))) : '<p class="empty">No payments yet.</p>'}
        ${s.topDone.length ? `<h3>Largest works marked complete</h3><ul class="list">${s.topDone.map((w) => `<li><b>${rupeesCr(w.amount)}</b> ${esc(w.kind)}<span class="meta">Finished ${esc(longDate(w.date))}, per the portal. Work ID ${esc(w.id || 'not given')}</span></li>`).join('')}</ul><p class="muted">Know one of these? Go and look. A portal saying "complete" is not the same as the thing being there and working.</p>` : ''}
        ${s.top.length ? `<h3>Largest payments</h3><ul class="list">${s.top.map((w) => `<li><b>${rupeesCr(w.amount)}</b> ${w.pending ? stageChip('pending') : stageChip('paid')} ${esc(w.kind)}<span class="meta">Agency ${esc(w.agency || 'not given')}. ${esc(longDate(w.date))}. Work ID ${esc(w.id || 'not given')}</span></li>`).join('')}</ul>` : ''}
        ${s.firms.length ? `<h3>Businesses paid most</h3>${bars(s.firms.map(([k, v]) => ({ name: k, value: v, color: COLOURS[6], text: rupeesCr(v) })))}<p class="muted">As named on the portal. Being paid is not a sign of wrongdoing. Names that look like private people are left out, so this list is partial.</p>` : ''}
        <div class="row-btns"><button class="action" id="seatRti" type="button">Ask for the records</button><a class="action" href="https://mplads.mospi.gov.in/" target="_blank" rel="noopener">Open the portal</a>${s.districts[0] ? `<button class="action ghost" id="seatCity" type="button">Open ${esc(s.districts[0])}</button>` : ''}</div>
        <div id="seatDraft"></div></div>`;
      $('#seatRti', el).addEventListener('click', () => {
        const who = s.house === 'Lok Sabha' ? `the Member of Parliament for ${s.seat}` : `Rajya Sabha member ${s.mp}`;
        $('#seatDraft', el).innerHTML = rtiBox(`MPLADS works recommended by ${who}, for the current term`, `District Magistrate, the MPLADS nodal authority for ${s.districts[0] || s.seat}`, (s.topDone[0] || s.top[0])?.id);
        wireRti($('#seatDraft', el));
      });
      $('#seatCity', el)?.addEventListener('click', () => { const n = s.districts[0]; ctx.closeDossier(); openCity(n); });
    }
    function paintList() {
      const q = filter.trim().toLowerCase();
      const list = data.seats.filter((s) => s.house === house && (!q || s.seat.toLowerCase().includes(q) || s.mp.toLowerCase().includes(q) || s.districts.some((d) => d.toLowerCase().includes(q))));
      const sorted = [...list].sort((a, b) => (sort === 'name' ? a.seat.localeCompare(b.seat) : b.paid - a.paid));
      const top = Math.max(1, ...sorted.map((s) => s.paid));
      $('#seatList', el).innerHTML = sorted.length ? `<div class="h-bars">${sorted.slice(0, 100).map((s) => `<button class="h-bar h-seat" data-seat="${esc(s.seat)}" aria-pressed="${s.seat === picked}"><span class="h-name">${esc(s.seat)}<small>${house === 'Lok Sabha' ? esc(s.mp) : `${count(s.done.n)} of ${count(s.rec.n)} complete`}</small></span><span class="h-track"><i style="width:${(100 * s.paid) / top}%;background:#1e7f3a"></i></span><b>${rupeesCr(s.paid)}</b></button>`).join('')}</div>` : '<p class="empty">No member matches that in this House. Try the other House or a district name.</p>';
      el.querySelectorAll('[data-seat]').forEach((b) => b.addEventListener('click', () => {
        picked = b.dataset.seat;
        paintList();
        paintCard();
        $('#seatCardInner', el)?.scrollIntoView({ block: 'nearest' });
      }));
    }
    $('#seatFilter', el).addEventListener('input', (e) => { filter = e.target.value; paintList(); });
    el.querySelectorAll('[data-sort]').forEach((b) => b.addEventListener('click', () => {
      sort = b.dataset.sort;
      el.querySelectorAll('[data-sort]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      paintList();
    }));
    el.querySelectorAll('[data-house]').forEach((b) => b.addEventListener('click', () => {
      house = b.dataset.house;
      picked = null;
      el.querySelectorAll('[data-house]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      paintHouse();
      paintList();
      paintCard();
    }));
    paintHouse();
    paintList();
  }

  /* Project ladder and RTI */
  const LADDER = [['cost', 'Budget or cost'], ['sanction', 'Sanction order'], ['contract', 'Contract or tender'], ['payments', 'Payments'], ['opened', 'Opened or finished']];
  function rtiBox(subject, office, sampleId) {
    const text = `To,
The Public Information Officer,
${office}

Subject: Request for information under the Right to Information Act, 2005

Sir or Madam,

I am a citizen of India. Under section 6(1) of the RTI Act, 2005, please provide the following for: ${subject}.${sampleId ? ` This includes work ID ${sampleId}.` : ''}

1. Certified copies of the administrative and financial sanction orders, with their dates and amounts.
2. The tender notice, the award of contract, and the contract value including any later changes.
3. Funds released and payments made, listed by date and amount.
4. The current physical status, with completion and utilisation certificates where issued.
5. Inspection or quality reports, and the name and designation of the officer responsible.

Please send this information by post or email. Application fee is paid as per rules.

Name: ____________
Address: ____________
Date: ____________`;
    return `<div class="rti"><p class="muted">Check the office before sending, because it may hold only part of this. Your name stays on your own copy, as this site stores nothing. This draft is not legal advice. Free help: NALSA 15100.</p>
      <textarea class="rti-text" rows="13" aria-label="RTI draft, you can edit this">${esc(text)}</textarea>
      <div class="row-btns"><button class="action rti-copy" type="button">Copy draft</button><a class="action" href="https://rtionline.up.gov.in/" target="_blank" rel="noopener">UP RTI portal</a><span class="muted rti-msg" role="status"></span></div></div>`;
  }
  function wireRti(root) {
    $('.rti-copy', root).addEventListener('click', async () => {
      const msg = $('.rti-msg', root);
      try {
        await navigator.clipboard.writeText($('.rti-text', root).value);
        msg.textContent = 'Copied.';
      } catch {
        $('.rti-text', root).select();
        msg.textContent = 'Copying is blocked here. The text is selected, so copy it yourself.';
      }
    });
  }
  function ladder(el) {
    const newsUrl = (q) => `https://news.google.com/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`;
    const kindChip = { official: 'official', press: 'reported', wiki: 'reported' };
    const sourceWord = { official: 'Government page', press: 'News source', wiki: 'Wikipedia' };
    const rung = (e, step) => {
      if (!e) return `<li><b>${esc(step)}</b>${stageChip('none')}</li>`;
      return `<li class="has has-${e.kind}"><b>${esc(step)}</b>${stageChip(kindChip[e.kind])}${e.differ ? ` ${stageChip('differ')}` : ''}<span class="rung-text">${esc(e.text)} <a href="${esc(e.url)}" target="_blank" rel="noopener">${sourceWord[e.kind]}</a></span></li>`;
    };
    const proofs = (p) => LADDER.filter(([k]) => EVIDENCE[p.name]?.[k]).length;
    el.innerHTML = `<p class="k-head">A big number is the start of the story.</p>
      <p class="lead">Each project gets five kinds of proof. "Opened" means someone cut a ribbon, and it says nothing about quality or final bills. No project below has a public payment record we could find, so that rung is empty everywhere. Ask for it.</p>
      ${PROJECTS.map((p, i) => `<details class="paper-card h-project" data-i="${i}"><summary>${esc(p.name)}<small>${proofs(p)} of 5 kinds of proof found</small></summary>
        <ol class="ladder">${LADDER.map(([k, step]) => rung(EVIDENCE[p.name]?.[k], step)).join('')}</ol>
        ${EVIDENCE[p.name]?.note ? `<p class="muted">${esc(EVIDENCE[p.name].note)} <a href="${esc(EVIDENCE[p.name].noteUrl)}" target="_blank" rel="noopener">Check it</a></p>` : ''}
        <p class="muted">Runs through ${esc(p.districts.join(', '))}. <a href="${newsUrl(`${p.name} progress`)}" target="_blank" rel="noopener">Latest news</a>.</p>
        <button class="action h-ask" type="button">Ask for the records</button><div class="h-draft"></div></details>`).join('')}
      <p class="muted">Checked by web search on 3 November 2026, and each link is what we read. Things may have changed since. Figures from different sources are not always measuring the same thing.</p>`;
    el.querySelectorAll('.h-project').forEach((card) => {
      $('.h-ask', card).addEventListener('click', () => {
        const p = PROJECTS[Number(card.dataset.i)];
        const slot = $('.h-draft', card);
        slot.innerHTML = rtiBox(p.name, 'the department or authority running this project', null);
        wireRti(slot);
      });
    });
  }

  /* Tenders and audit */
  async function watch(el) {
    el.innerHTML = `<p class="k-head">Money about to move, and what auditors said</p>
      <h3>Latest tenders in UP</h3>
      <p class="lead">${stageChip('tender')} Bids invited, which means nobody has been paid yet.</p>
      <div class="lookup"><input id="tenderFilter" aria-label="Search these tenders" placeholder="Search by place or work"></div>
      <div id="tenderList">Loading…</div>
      <p class="muted">Only the short public list from the <a href="https://etender.up.nic.in/nicgep/app" target="_blank" rel="noopener">UP e-tender portal</a>, refreshed every 15 minutes when the portal answers. It changes constantly and is nowhere near every tender. To search all of them, use the portal itself. Not joined to projects here, since the portal offers no open link between them.</p>
      <h3>CAG audit reports on UP</h3><div id="auditList">Loading…</div>`;
    let tenders = [];
    const paint = (q = '') => {
      const slot = $('#tenderList', el);
      if (!slot) return;
      const list = tenders.filter((t) => !q || t.title.toLowerCase().includes(q.toLowerCase()));
      slot.innerHTML = list.length ? `<ul class="list">${list.map((t) => `<li>${esc(t.title)}<span class="meta">Ref ${esc(t.ref)}. Closes ${esc(t.closes)}</span></li>`).join('')}</ul>` : '<p class="empty">No tender in this short list matches that.</p>';
    };
    $('#tenderFilter', el).addEventListener('input', (e) => paint(e.target.value));
    loadTenders().then((t) => { tenders = t; paint(); }).catch((err) => {
      const slot = $('#tenderList', el);
      if (slot) slot.innerHTML = `<p class="empty">Could not read the tender list: ${esc(err.message)}. <a href="https://etender.up.nic.in/nicgep/app" target="_blank" rel="noopener">Open the portal</a>.</p>`;
    });
    loadAudit().then((a) => {
      const slot = $('#auditList', el);
      if (!slot) return;
      slot.innerHTML = `${a.reports.length ? `<ul class="list">${a.reports.map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a></li>`).join('')}</ul>` : '<p class="empty">None found with UP in the title on the pages we read.</p>'}
        <p class="muted">Reports with UP in the title, from the most recent pages of the <a href="${esc(a.source)}" target="_blank" rel="noopener">CAG list</a>, as of ${esc(longDate(a.fetchedAt.slice(0, 10)))}. Older reports and those covering many states may be missing. We link them and have not read or summarised them.</p>`;
    }).catch(() => {
      const slot = $('#auditList', el);
      if (slot) slot.innerHTML = '<p class="empty">Could not load the audit list.</p>';
    });
  }

  /* Sources and gaps */
  function sources(el, b, mp) {
    const rows = [
      { what: 'State budget and actuals, by sector', stage: ['promised', 'revised', 'spent'], who: 'PRS Legislative Research', url: b.source, as: `Budget presented ${b.presented}`, limit: 'State-wide only, with no district figures. PRS summarises state documents.' },
      { what: 'MP fund works and payments', stage: ['recommended', 'sanctioned', 'completed', 'paid', 'pending'], who: 'MoSPI MPLADS portal', url: mp?.source || 'https://mplads.mospi.gov.in/', as: mp ? `${longDate(mp.fetchedAt.slice(0, 10))}. The server rechecks every 6 hours` : 'Not loaded', limit: 'Sitting members of both Houses. "Complete" is the portal\'s word, not an inspection.' },
      { what: 'Project proof', stage: ['official', 'reported', 'differ'], who: 'Government pages, press and Wikipedia, entered by hand', url: 'https://upeida.up.gov.in/en/page/ganga-expressway', as: 'Checked 3 Nov 2026', limit: 'Each rung links what we read. No payment records.' },
      { what: 'Latest tenders', stage: ['tender'], who: 'UP e-tender portal, public home list', url: 'https://etender.up.nic.in/nicgep/app', as: 'Every 15 minutes when the portal answers, and it often gives errors', limit: 'A short rolling list. The portal\'s full search has a captcha, and we do not go past it.' },
      { what: 'Audit reports', stage: ['official'], who: 'CAG', url: 'https://cag.gov.in/en/audit-report', as: 'From the data build', limit: 'Links only, picked by title. Not read or summarised.' },
    ];
    const gaps = [
      ['Following your own rupee', 'Not possible for anyone. Tax goes into one pool, so a rupee has no label by the time it is spent.', 'https://prsindia.org/budgets/states'],
      ['District-wise state spending', 'The treasury portal Koshvani has it, but it refused our automated reads. Try it in your browser.', 'https://koshvani.up.nic.in/'],
      ['Payments on big projects', 'No public record found for the 12 projects here. An RTI is the way to ask.', 'https://rtionline.up.gov.in/'],
      ['Whether a finished work is real and any good', 'No portal can prove this. Go and look.', 'https://mplads.mospi.gov.in/'],
      ['Earlier terms of MPs', 'The public report covers sitting members only.', 'https://mplads.mospi.gov.in/'],
      ['Scheme payments', 'PFMS has them, with no open file we could use.', MONEY_LINKS.find((m) => /PFMS/.test(m.label))?.url],
      ['Village spending', 'eGramSwaraj has each panchayat, one at a time. Not collected here.', MONEY_LINKS.find((m) => /eGramSwaraj/.test(m.label))?.url],
    ];
    el.innerHTML = `<p class="k-head">What each kind of proof means</p>
      <ul class="list h-defs">${STAGES.map((s) => `<li>${stageChip(s.key)}<span class="meta">${esc(s.help)}</span></li>`).join('')}</ul>
      <p class="lead"><b>Stages never add up.</b> A budget, a sanction and a payment can be the same money seen three times.</p>
      <h3>What this page uses</h3><ul class="list">${rows.map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.what)}</a><br>${r.stage.map(stageChip).join(' ')}<span class="meta">${esc(r.who)}. ${esc(r.as)}. ${esc(r.limit)}</span></li>`).join('')}</ul>
      <h3>What we still don't know</h3><ul class="list">${gaps.map(([a, c, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(a)}</a><span class="meta">${esc(c)}</span></li>`).join('')}</ul>
      <p class="muted">The evidence stages and the show-your-gaps rule are inspired by the open <a href="https://github.com/theadiram/Hisaab" target="_blank" rel="noopener">Hisaab</a> project, MIT licensed. No code or data was copied, and it is not connected to this page.</p>`;
  }

  /* Page */
  const TABS = [['hundred', 'Tera ₹100'], ['promise', 'Vaada vs Asli'], ['khata', 'MP ka khata'], ['ladder', 'Project ladder'], ['watch', 'Tender, audit'], ['sources', 'Sources, gaps']];
  return async function render(shell, setCleanup) {
    shell('Mera Hisaab', `<div class="g-pad"><p class="lead">Where UP's money goes, with proof for each step and the gaps left showing.</p>
      <div class="tags h-tabs">${TABS.map(([k, l], i) => `<button data-htab="${k}" aria-pressed="${i === 0}"><span>${esc(l)}</span></button>`).join('')}</div><div id="hBody">Loading…</div></div>`, { sheet: false, map: true });
    const clearOverlay = () => {
      if (!state.overlay) return;
      state.overlay = null;
      state.layer.setStyle(ctx.style);
    };
    setCleanup(clearOverlay);
    let budget;
    try { budget = await loadBudget(); } catch (err) {
      const slot = $('#hBody');
      if (slot) slot.innerHTML = `<p class="empty">Could not load the budget data: ${esc(err.message)}.</p>`;
      return;
    }
    const open = (key) => {
      const body = $('#hBody');
      if (!body) return;
      clearOverlay();
      // The khata tab is led by the map, so the page narrows and leaves it in view
      $('#dossier').classList.toggle('sheet', key === 'khata');
      document.querySelectorAll('[data-htab]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.htab === key));
      if (key === 'hundred') hundred(body, budget);
      if (key === 'promise') promise(body, budget);
      if (key === 'khata') khata(body);
      if (key === 'ladder') ladder(body);
      if (key === 'watch') watch(body);
      if (key === 'sources') {
        sources(body, budget, null);
        loadMplads().then((mp) => { if (body.isConnected && document.querySelector('[data-htab="sources"]')?.getAttribute('aria-pressed') === 'true') sources(body, budget, mp); }).catch(() => {});
      }
    };
    document.querySelectorAll('[data-htab]').forEach((b) => b.addEventListener('click', () => open(b.dataset.htab)));
    open('hundred');
  };
}
