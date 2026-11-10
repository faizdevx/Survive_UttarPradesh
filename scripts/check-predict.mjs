// Self-check for the prediction maths. Run with: node scripts/check-predict.mjs
import assert from 'node:assert';
import fs from 'node:fs';
import { encode, decode, swing, tally, score, sharingBarred } from '../public/js/predict.js';

const seats = JSON.parse(fs.readFileSync('public/data/seats.json'));
const base = decode('', seats);
assert.equal(encode(base, seats), '');
assert.deepEqual(Object.fromEntries(tally(base)), { BJP: 255, SP: 111, ADS: 12, RLD: 8, SBSP: 6, NISHAD: 6, INC: 2, JDL: 2, BSP: 1 });

// A changed map survives the trip through a link, including the last seat
const mine = { ...base, 1: 'BSP', 171: 'OTH', 403: 'BJP' };
assert.deepEqual(decode(encode(mine, seats), seats), mine);
assert.deepEqual(decode('zzz!!not a code', seats), base);

// Lucknow West: SP 48.19, BJP 45.03, gap 3.16. A 1.5 point move is not enough, 1.6 is.
assert.equal(swing(seats, base, 'SP', 'BJP', 1.5)[171], 'SP');
assert.equal(swing(seats, base, 'SP', 'BJP', 1.6)[171], 'BJP');
assert.equal(swing(seats, base, 'SP', 'BJP', 0)[171], 'SP');

assert.deepEqual(score(mine, { 1: 'BSP', 2: 'XYZ', 171: 'AIMIM' }), { right: 2, of: 3 });

const at = (iso) => new Date(iso).getTime();
assert.equal(sharingBarred(at('2027-02-01T12:00:00+05:30'), []), false);
assert.equal(sharingBarred(at('2027-02-07T12:00:00+05:30'), ['2027-02-10', '2027-03-07']), false);
assert.equal(sharingBarred(at('2027-02-08T12:00:00+05:30'), ['2027-02-10', '2027-03-07']), true);
assert.equal(sharingBarred(at('2027-03-07T18:00:00+05:30'), ['2027-02-10', '2027-03-07']), true);
assert.equal(sharingBarred(at('2027-03-07T19:00:00+05:30'), ['2027-02-10', '2027-03-07']), false);
console.log('ok');
