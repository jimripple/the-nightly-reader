import assert from 'node:assert/strict';
import { editions, allWorks } from './data.js';
import { generateEdition, distribution } from './generator.js';

const seeded=editions.filter(edition=>edition.date<='2026-09-21');
const automated=editions.filter(edition=>edition.date>'2026-09-21');
assert.equal(seeded.length, 7, 'seven original editions remain seeded');
assert.equal(allWorks.length, editions.length*3, 'each edition has three works');
assert.ok(seeded.every(e => ['story','poem','essay'].every(type => e.works.filter(w=>w.type===type).length===1)), 'seed editions retain all three original forms');
assert.ok(automated.every(e=>e.works.some(w=>w.type==='article')&&e.works.some(w=>w.type==='poem')&&e.works.some(w=>['story','essay'].includes(w.type))), 'automated editions mix a current article, poetry, and a rotating classic');
assert.ok(allWorks.every(w => w.sourceUrl.startsWith('https://') && w.copyright), 'sources and rights are present');
assert.ok(automated.flatMap(e=>e.works).filter(w=>w.type==='article').every(w=>w.access==='external'&&w.copyright.startsWith('Copyrighted')), 'modern articles remain linked summaries');
assert.equal(new Set(allWorks.map(w=>w.id)).size, allWorks.length, 'work IDs are unique');
assert.ok(new Set(allWorks.map(w=>w.author.culture)).size >= 7, 'seed spans at least seven cultural traditions');
const retry = generateEdition({date:editions[0].date, editions, candidates:allWorks});
assert.equal(retry.created, false, 'same-day generation is idempotent');
assert.equal(retry.edition.id, editions[0].id, 'retry preserves the valid edition');
assert.ok(Object.keys(distribution(editions,'culture')).length >= 7, 'distribution supports curriculum balancing');
console.log('✓ 10 curriculum, automation, rights, source, and idempotency checks passed');
