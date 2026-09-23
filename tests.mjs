import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { editions, allWorks } from './data.js';
import { generateEdition, distribution } from './generator.js';

const seeded=editions.filter(edition=>edition.date<='2026-09-21');
const automated=editions.filter(edition=>edition.date>'2026-09-21');
assert.equal(seeded.length, 7, 'seven original editions remain seeded');
assert.equal(allWorks.length, editions.length*3, 'each edition has three works');
assert.ok(seeded.every(e => ['story','poem','essay'].every(type => e.works.filter(w=>w.type===type).length===1)), 'seed editions retain all three original forms');
assert.ok(automated.every(e=>['article','poem','story'].every(type=>e.works.filter(w=>w.type===type).length===1)), 'automated editions include exactly one article, poem, and short story');
assert.ok(allWorks.every(w => w.sourceUrl.startsWith('https://') && w.copyright), 'sources and rights are present');
assert.ok(automated.flatMap(e=>e.works).filter(w=>w.type==='article').every(w=>w.access==='external'&&w.copyright.startsWith('Copyrighted')), 'modern articles remain linked summaries');
assert.equal(new Set(allWorks.map(w=>w.id)).size, allWorks.length, 'work IDs are unique');
assert.ok(new Set(allWorks.map(w=>w.author.culture)).size >= 7, 'seed spans at least seven cultural traditions');
const retry = generateEdition({date:editions[0].date, editions, candidates:allWorks});
assert.equal(retry.created, false, 'same-day generation is idempotent');
assert.equal(retry.edition.id, editions[0].id, 'retry preserves the valid edition');
assert.ok(Object.keys(distribution(editions,'culture')).length >= 7, 'distribution supports curriculum balancing');
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const initialThemeScript=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(initialThemeScript, 'initial theme is set before the stylesheet loads');
function initialTheme(savedTheme,deviceDark){
  const document={documentElement:{dataset:{}},querySelector:()=>({content:''})};
  runInNewContext(initialThemeScript,{document,localStorage:{getItem:()=>savedTheme},matchMedia:()=>({matches:deviceDark})});
  return document.documentElement.dataset.theme;
}
assert.equal(initialTheme(null,true),'dark','new visitors follow a dark device setting');
assert.equal(initialTheme(null,false),'light','new visitors follow a light device setting');
assert.equal(initialTheme('light',true),'light','a saved choice overrides the device setting');
assert.equal(initialTheme('dark',false),'dark','a saved dark choice remains dark');
console.log('✓ 14 curriculum, automation, rights, source, idempotency, and theme checks passed');
