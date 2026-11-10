// Builds public/data/reportcards.json: what each sitting MLA declared in their own 2022 affidavit.
// Source: one MyNeta/ADR candidate page per MLA. Run with: node --dns-result-order=ipv4first scripts/build-reportcards.mjs
import fs from 'node:fs';
import assert from 'node:assert';

const BASE = 'https://www.myneta.info/uttarpradesh2022/candidate.php?candidate_id=';
const rupees = (s) => (s && /[\d,]{3,}/.test(s) ? Number(s.match(/[\d,]+/)[0].replace(/,/g, '')) : null);

// Tags become bars, so every table cell is one field
export function parse(html) {
  const t = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '|').replace(/&nbsp;/g, ' ').replace(/(\|\s*)+/g, '|').replace(/\s+/g, ' ');
  const field = (re) => t.match(re)?.[1]?.trim() || null;
  const between = (a, b) => { const i = t.indexOf(a); const j = t.indexOf(b, i + 1); return i < 0 || j < 0 ? null : t.slice(i + a.length, j); };

  const liab = field(/Liabilities: \|([^|]+)/);
  const chargeText = between('Brief Details of IPC / BNS', 'Cases where Pending') || '';
  const charges = [...chargeText.matchAll(/(\d+) \|charges related to ([^|]+?) \((?:IPC|BNS) Section-([\w-]+)\)/g)].map((m) => ({ n: Number(m[1]), what: m[2].trim(), section: m[3] }));
  const convictedText = between('Cases where Convicted', 'Disclaimer');
  const earlier = [...(between('Other Elections', 'Click here for more details') || '').matchAll(/\|([^|]*?(?:19|20)\d\d[^|]*)\|(Rs ?[\d,]+|Nil)?\|?(?:~[^|]*\|)?(\d+)\|/g)]
    .map((m) => ({ where: m[1].trim(), assets: rupees(m[2]), cases: Number(m[3]) }));
  return {
    // The photo the candidate attached to the affidavit
    photo: html.match(/<img src=['"]?(https:\/\/(?:www\.)?myneta\.info\/images_candidate\/[^'"\s>]+)/)?.[1] || null,
    age: Number(field(/Age:\|(\d+)/)) || null,
    job: field(/Self Profession:\|([^|]+)\|Spouse/),
    liabilities: liab == null ? null : /nil/i.test(liab) ? 0 : rupees(liab),
    income: rupees(field(/Total Income Shown in ITR\|self\|[YN]\|[^|]*\|[^|]*\|(Rs [\d,]+)/)),
    charges,
    // Only "none" is ever stated. Anything else sends the reader to the affidavit itself.
    noConviction: convictedText == null ? null : /No Cases/.test(convictedText),
    earlier,
  };
}

// Self-check against a saved page: node scripts/build-reportcards.mjs --check <file>
if (process.argv[2] === '--check') {
  const r = parse(fs.readFileSync(process.argv[3], 'utf8'));
  assert.match(r.photo, /images_candidate\/uttarpradesh2022\/\w+\.jpg$/);
  assert.equal(r.age, 52);
  assert.equal(r.liabilities, 0);
  assert.equal(r.noConviction, true);
  assert.equal(r.income, 545141);
  assert.deepEqual(r.charges[0], { n: 1, what: 'Punishment for dacoity', section: '395' });
  assert.deepEqual(r.earlier[0], { where: 'Uttar Pradesh 2017', assets: 7169578, cases: 3 });
  console.log('ok', r);
  process.exit(0);
}

const seats = JSON.parse(fs.readFileSync('public/data/seats.json'));
const out = {};
const failed = [];
fs.mkdirSync('data/mla-raw', { recursive: true });
// Three at a time keeps the run near ten minutes without leaning on MyNeta
const todo = Object.values(seats).filter((s) => s.mla?.id);
const one = async (s) => {
  const { id } = s.mla;
  try {
    const r = await fetch(BASE + id, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(r.status);
    out[id] = parse(await r.text());
    // Raw photos stay out of the site folder. scripts/build-cards.py shrinks them into public/img/mla.
    const { photo } = out[id];
    delete out[id].photo;
    if (photo) {
      const img = await fetch(photo, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) });
      if (img.ok && /^image\//.test(img.headers.get('content-type') || '')) fs.writeFileSync(`data/mla-raw/${id}.jpg`, Buffer.from(await img.arrayBuffer()));
    }
  } catch (err) { failed.push([s.name, id, String(err.message)]); }
};
for (let i = 0; i < todo.length; i += 3) {
  await Promise.all(todo.slice(i, i + 3).map(one));
  await new Promise((r) => setTimeout(r, 300));
}
fs.writeFileSync('public/data/reportcards.json', JSON.stringify({ fetchedAt: new Date().toISOString(), source: 'https://www.myneta.info/uttarpradesh2022/', mlas: out }));
const all = Object.values(out);
console.log({ mlas: all.length, withAge: all.filter((x) => x.age).length, withCharges: all.filter((x) => x.charges.length).length, withEarlier: all.filter((x) => x.earlier.length).length, liabilitiesKnown: all.filter((x) => x.liabilities != null).length, convictionUnknown: all.filter((x) => x.noConviction !== true).length, failed });
