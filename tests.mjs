import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { editions, allWorks } from './data.js';
import { generateEdition, distribution } from './generator.js';
import { cleanArticleSummary, isReadableArticleCandidate } from './scripts/article-eligibility.mjs';
import { cleanSourceText } from './content/clean-source-text.js';
import { replacedWorks } from './content/replaced-works.js';
import { editionScheduleMessage } from './edition-status.js';
import { checkDailyEdition } from './scripts/check-daily-edition.mjs';
import { GET as checkEditionRoute } from './api/check-edition.js';

const seeded=editions.filter(edition=>edition.date<='2026-09-21');
const automated=editions.filter(edition=>edition.date>'2026-09-21');
assert.equal(seeded.length, 7, 'seven original editions remain seeded');
assert.equal(allWorks.length, editions.length*3, 'each edition has three works');
assert.ok(seeded.every(e => ['story','poem','essay'].every(type => e.works.filter(w=>w.type===type).length===1)), 'seed editions retain all three original forms');
assert.ok(automated.every(e=>['article','poem','story'].every(type=>e.works.filter(w=>w.type===type).length===1)), 'automated editions include exactly one article, poem, and short story');
assert.ok(allWorks.every(w => w.sourceUrl.startsWith('https://') && w.copyright), 'sources and rights are present');
assert.ok(automated.flatMap(e=>e.works).filter(w=>w.type==='article').every(w=>w.access==='external'&&w.copyright.startsWith('Copyrighted')), 'modern articles remain linked summaries');
assert.equal(isReadableArticleCandidate({link:'https://aeon.co/videos/a-history',author:'Aeon Video',category:'Ideas',summary:'Watch on Aeon'}),false,'video feed items cannot fill the article slot');
assert.equal(isReadableArticleCandidate({link:'https://publicdomainreview.org/collection/a-manuscript',author:'The Public Domain Review',category:'Ideas',summary:'An illustrated collection.'}),false,'image collections cannot fill the article slot');
assert.equal(isReadableArticleCandidate({link:'https://aeon.co/essays/a-history',author:'Jane Writer',category:'Ideas',summary:'A readable essay about history.'}),true,'written articles remain eligible');
assert.equal(isReadableArticleCandidate({link:'https://publicdomainreview.org/essay/a-history',author:'Jane Writer',category:'Ideas',summary:'A readable essay about history.'}),true,'written essays from The Public Domain Review remain eligible');
assert.equal(cleanArticleSummary('Caring for farms and neighbours - by Craig Maier Read on Aeon'),'Caring for farms and neighbours','feed navigation is removed from the article summary');
assert.equal(cleanSourceText('Best Russian Short Stories\n\nThe Queen of Spades\n\nBy Aleksandr S. Pushkin\n\nI\n\nThere was a card party.', 'The Queen of Spades'),'There was a card party.','imported collection headings are removed before reading');
assert.ok(automated.flatMap(e=>e.works).filter(w=>w.type==='article').every(isReadableArticleCandidate),'published article slots link to written articles');
assert.ok(replacedWorks.some(w=>w.id==='article-2026-09-24-772c013aea'&&w.editionDate==='2026-09-24'&&w.sourceUrl.startsWith('https://')),'notes and favorites on the replaced video retain their original metadata');
assert.equal(new Set(allWorks.map(w=>w.id)).size, allWorks.length, 'work IDs are unique');
assert.ok(new Set(allWorks.map(w=>w.author.culture)).size >= 7, 'seed spans at least seven cultural traditions');
const retry = generateEdition({date:editions[0].date, editions, candidates:allWorks});
assert.equal(retry.created, false, 'same-day generation is idempotent');
assert.equal(retry.edition.id, editions[0].id, 'retry preserves the valid edition');
assert.ok(Object.keys(distribution(editions,'culture')).length >= 7, 'distribution supports curriculum balancing');
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const workflow=readFileSync(new URL('./.github/workflows/daily-edition.yml',import.meta.url),'utf8');
const buildScript=readFileSync(new URL('./build.mjs',import.meta.url),'utf8');
assert.match(buildScript,/['"]edition-status\.js['"]/,'the production bundle includes the schedule-status module');
assert.match(workflow,/cron: ["']30 14 \* \* \*["']\s+timezone: ["']America\/Detroit["']/,'primary edition run is scheduled for 2:30 p.m. Detroit time');
assert.match(workflow,/cron: ["']30 15 \* \* \*["']\s+timezone: ["']America\/Detroit["']/,'backup edition run is scheduled for 3:30 p.m. Detroit time');
assert.ok(!app.includes('id="settings-form"')&&html.includes('Notes &amp; privacy'),'unused reader-selection controls are hidden while notes remain accessible');
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
assert.equal(editionScheduleMessage('2026-09-24',new Date('2026-09-25T18:22:00Z')),'New edition scheduled daily for 2:30 p.m. Eastern','before publication time the schedule is clear');
assert.match(editionScheduleMessage('2026-09-24',new Date('2026-09-25T20:01:00Z')),/running late/,'stale editions are clearly identified after 4 p.m. Eastern');
assert.doesNotMatch(editionScheduleMessage('2026-09-25',new Date('2026-09-25T20:01:00Z')),/running late/,'a current edition is never labeled late');
const cron=JSON.parse(readFileSync(new URL('./vercel.json',import.meta.url),'utf8')).crons;
assert.deepEqual(cron,[{path:'/api/check-edition',schedule:'0 20 * * *'}],'Vercel has one daily always-on fallback');
const checkTime=new Date('2026-09-25T20:15:00Z');
const healthyCalls=[];
const healthy=await checkDailyEdition({now:checkTime,token:'test-token',fetchImpl:async url=>{
  healthyCalls.push(url);
  return Response.json([{date:'2026-09-25',works:[{type:'article'},{type:'poem'},{type:'story'}]}]);
}});
assert.equal(healthy.status,'healthy','a complete live edition needs no dispatch');
assert.equal(healthyCalls.length,1,'healthy check never calls GitHub');
const runningCalls=[];
const running=await checkDailyEdition({now:checkTime,token:'test-token',fetchImpl:async url=>{
  runningCalls.push(url);
  return runningCalls.length===1?Response.json([]):Response.json({workflow_runs:[{status:'in_progress',created_at:'2026-09-25T19:00:00Z'}]});
}});
assert.equal(running.status,'publisher-running','an active publisher prevents a duplicate dispatch');
assert.equal(runningCalls.length,2);
const staleCalls=[];
const dispatched=await checkDailyEdition({now:checkTime,token:'test-token',fetchImpl:async (url,options={})=>{
  staleCalls.push({url,options});
  if(staleCalls.length===1)return Response.json([]);
  if(staleCalls.length===2)return Response.json({workflow_runs:[]});
  return new Response(null,{status:204});
}});
assert.equal(dispatched.status,'publisher-dispatched','a stale edition with no active run triggers one dispatch');
assert.equal(staleCalls.filter(call=>call.options.method==='POST').length,1);
assert.equal((await checkEditionRoute(new Request('https://example.com/api/check-edition'))).status,401,'the cron endpoint rejects unauthenticated requests');
const originalCronSecret=process.env.CRON_SECRET, originalDispatchToken=process.env.GITHUB_DISPATCH_TOKEN;
try {
  process.env.CRON_SECRET='test-secret';
  delete process.env.GITHUB_DISPATCH_TOKEN;
  const configuredRequest=new Request('https://example.com/api/check-edition',{headers:{authorization:'Bearer test-secret'}});
  assert.equal((await checkEditionRoute(configuredRequest)).status,503,'missing GitHub credentials cannot silently pass a cron check');
} finally {
  if(originalCronSecret===undefined)delete process.env.CRON_SECRET; else process.env.CRON_SECRET=originalCronSecret;
  if(originalDispatchToken===undefined)delete process.env.GITHUB_DISPATCH_TOKEN; else process.env.GITHUB_DISPATCH_TOKEN=originalDispatchToken;
}
console.log('✓ Curriculum, automation, source, reading, privacy, idempotency, and theme checks passed');
