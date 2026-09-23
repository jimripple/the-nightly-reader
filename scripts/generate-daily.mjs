import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { editions, allWorks } from '../data.js';

const feeds = [
  { name:'Smithsonian Magazine', url:'https://www.smithsonianmag.com/rss/latest_articles/', host:'smithsonianmag.com', culture:'American' },
  { name:'Aeon', url:'https://aeon.co/feed.rss', host:'aeon.co', culture:'International' },
  { name:'The Conversation', url:'https://theconversation.com/us/articles.atom', host:'theconversation.com', culture:'International' },
  { name:'The Public Domain Review', url:'https://publicdomainreview.org/feed/', host:'publicdomainreview.org', culture:'International' },
];
const parser = new XMLParser({ ignoreAttributes:false, attributeNamePrefix:'@_', removeNSPrefix:true, trimValues:true });
const dateArg = process.argv.find(arg=>arg.startsWith('--date='))?.split('=')[1];
const date = dateArg || new Intl.DateTimeFormat('en-CA',{timeZone:'America/Detroit',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid edition date: ${date}`);

const asArray = value => value == null ? [] : Array.isArray(value) ? value : [value];
const textOf = value => typeof value==='string' || typeof value==='number' ? String(value) : value?.['#text'] || value?.name || '';
const clean = value => textOf(value).replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#(?:39|x27);/gi,"'").replace(/\s+/g,' ').trim();
const shorten = (value,limit=420) => { const text=clean(value); if(text.length<=limit)return text; const clipped=text.slice(0,limit); const end=Math.max(clipped.lastIndexOf('. '),clipped.lastIndexOf(' ')); return `${clipped.slice(0,end>200?end:limit)}…`; };
const hash = value => createHash('sha256').update(value).digest('hex').slice(0,10);

function rssItems(parsed, source){
  const channel=parsed.rss?.channel;
  if(channel) return asArray(channel.item).map(item=>({
    title:clean(item.title), link:clean(item.link)||clean(item.guid), author:clean(item.creator)||clean(item.author)||source.name,
    summary:shorten(item.description||item.encoded), published:clean(item.pubDate||item.date), category:clean(asArray(item.category)[0])||'Ideas'
  }));
  return asArray(parsed.feed?.entry).map(item=>({
    title:clean(item.title),
    link:clean(asArray(item.link).find(link=>link?.['@_rel']==='alternate')?.['@_href']||asArray(item.link)[0]?.['@_href']||item.link),
    author:clean(asArray(item.author)[0]?.name)||source.name,
    summary:shorten(item.summary||item.content), published:clean(item.published||item.updated), category:clean(asArray(item.category)[0]?.['@_term'])||'Ideas'
  }));
}

async function loadFeed(source){
  const response=await fetch(source.url,{headers:{'user-agent':'The Nightly Reader/1.0 (+https://the-nightly-reader.vercel.app)'},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`${source.name} feed returned ${response.status}`);
  return rssItems(parser.parse(await response.text()),source).map(item=>({...item,source}));
}

function validCandidate(item){
  try{
    const url=new URL(item.link), age=(new Date(`${date}T23:59:59Z`)-new Date(item.published))/86400000;
    return item.title.length>12&&item.summary.length>60&&url.hostname.endsWith(item.source.host)&&Number.isFinite(age)&&age>=-2&&age<=30;
  }catch{return false}
}

function chooseModern(items){
  const usedUrls=new Set(allWorks.map(work=>work.sourceUrl));
  const recentModern=editions.slice(0,10).flatMap(edition=>edition.works).filter(work=>work.access==='external');
  const sourceCounts=recentModern.reduce((counts,work)=>(counts[work.source]=(counts[work.source]||0)+1,counts),{});
  const eligible=items.filter(validCandidate).filter(item=>!usedUrls.has(item.link));
  eligible.sort((a,b)=>(sourceCounts[a.source.name]||0)-(sourceCounts[b.source.name]||0)||new Date(b.published)-new Date(a.published)||hash(`${date}${a.link}`).localeCompare(hash(`${date}${b.link}`)));
  if(!eligible[0])throw new Error('No unused, recent modern article was available from the verified feeds');
  return eligible[0];
}

function chooseClassic(type){
  const recentBases=new Set(editions.slice(0,6).flatMap(edition=>edition.works).map(work=>work.baseId||work.id));
  const recentAuthors=editions.slice(0,8).flatMap(edition=>edition.works).reduce((counts,work)=>(counts[work.author.name]=(counts[work.author.name]||0)+1,counts),{});
  const unique=new Map();
  allWorks.filter(work=>work.type===type&&work.access!=='external').forEach(work=>unique.set(work.baseId||work.id,work));
  const candidates=[...unique.values()].sort((a,b)=>Number(recentBases.has(a.baseId||a.id))-Number(recentBases.has(b.baseId||b.id))||(recentAuthors[a.author.name]||0)-(recentAuthors[b.author.name]||0)||hash(`${date}${a.id}`).localeCompare(hash(`${date}${b.id}`)));
  if(!candidates[0])throw new Error(`No verified ${type} candidate available`);
  const base=candidates[0];
  return {...base,id:`daily-${date}-${base.baseId||base.id}`,baseId:base.baseId||base.id,rationale:'Selected for chronological and cultural contrast; recent author repetition is penalized.'};
}

if(editions.some(edition=>edition.date===date)){
  console.log(`✓ Edition ${date} already exists; no changes made.`);
  process.exit(0);
}

const results=await Promise.allSettled(feeds.map(loadFeed));
const failures=results.filter(result=>result.status==='rejected');
const feedItems=results.flatMap(result=>result.status==='fulfilled'?result.value:[]);
if(results.filter(result=>result.status==='fulfilled').length<2)throw new Error(`Too few healthy feeds: ${failures.map(result=>result.reason.message).join('; ')}`);
const article=chooseModern(feedItems);
const publishedYear=new Date(article.published).getUTCFullYear();
const modern={
  id:`article-${date}-${hash(article.link)}`,type:'article',title:article.title,
  author:{name:article.author||article.source.name,lifespan:'Contemporary',culture:article.source.culture},
  year:publishedYear,minutes:8,category:article.category,century:'21st century',
  intro:`A current piece from ${article.source.name}, selected to place tonight’s older works in conversation with the present.`,
  source:article.source.name,sourceUrl:article.link,copyright:'Copyrighted; linked summary',access:'external',
  text:article.summary,tags:['contemporary',article.category.toLowerCase()].filter(Boolean),difficulty:'Moderate',
  rationale:'Recent, source-verified, and selected with a penalty against repeatedly using the same publication.'
};
const works=[modern,chooseClassic('poem'),chooseClassic('story')];
const next={
  id:date,date,number:Math.max(0,...editions.map(edition=>edition.number))+1,
  theme:'The Present and the Permanent',
  curatorNote:`A current article from ${article.source.name} meets a poem and a short story from another time. Read for resonance, disagreement, and distance.`,
  works
};
const jsonUrl=new URL('../content/daily-editions.json',import.meta.url);
const jsUrl=new URL('../content/daily-editions.js',import.meta.url);
const existing=JSON.parse(await readFile(jsonUrl,'utf8'));
const daily=[next,...existing.filter(edition=>edition.date!==date)].sort((a,b)=>b.date.localeCompare(a.date));
await writeFile(jsonUrl,`${JSON.stringify(daily,null,2)}\n`);
await writeFile(jsUrl,`// Generated by scripts/generate-daily.mjs. Do not edit by hand.\nexport const dailyEditions = ${JSON.stringify(daily,null,2)};\n`);
console.log(`✓ Created edition ${date}: ${works.map(work=>work.title).join(' · ')}`);
if(failures.length)console.warn(`Feed warnings: ${failures.map(result=>result.reason.message).join('; ')}`);
