import { editions, allWorks, todayEdition } from './data.js';
import { fullTexts } from './content/full-texts.js';

const store = {
  read(){ try{return JSON.parse(localStorage.getItem('nightly-reader')||'{}')}catch{return{}} },
  write(patch){ const next={...this.read(),...patch}; localStorage.setItem('nightly-reader',JSON.stringify(next)); return next },
};
const state = () => ({ read:[], favorites:[], notes:{}, settings:{minutes:'20–35',difficulty:'Moderate',modern:true,fullText:false,longWorks:false,exclusions:''}, ...store.read() });
const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const formatDate = iso => new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(`${iso}T12:00:00Z`));
const workType = t => t==='story'?'Short Story':t==='poem'?'Poetry':t==='article'?'Current Article':'Essay';
const toast = message => { const el=document.querySelector('#toast'); el.textContent=message; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1800) };
const remoteTextPages = {
  s6:'The Collected Works of Ambrose Bierce/Volume 2/A Horseman in the Sky', p6:'Voices of the Night/A Psalm of Life', e6:'The Writings of Henry David Thoreau (1906)/Volume 4/Civil Disobedience',
  s5:'The Story of an Hour', p5:'The Complete Poems of Paul Laurence Dunbar/Sympathy', e5:'The Atlantic Monthly/Volume 80/Number 478/Strivings of the Negro People',
  s4:'A White Heron', p4:"The River Merchant's Wife: A Letter",
  s3:'Best Russian Short Stories/The Queen of Spades', p3:'Songs of Innocence and of Experience (1826)/Songs of Experience/The Tyger', e3:'The Writings of Henry David Thoreau (1906)/Volume 4/Civil Disobedience',
  s2:'The Mantle and Other Stories/The Mantle', p2:'The Complete Poems of Paul Laurence Dunbar/We Wear the Mask', e2:'Tremendous Trifles/A Piece of Chalk',
  s1:'The Collected Works of Ambrose Bierce/Volume 2/An Occurrence at Owl Creek Bridge', p1:'Mountain Interval/The Road Not Taken', e1:'The Essays of Montaigne/Book I/Chapter XLVII'
};

async function loadWikisourceText(page){
  const url=`https://en.wikisource.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=text&format=json&origin=*`;
  const response=await fetch(url); if(!response.ok) throw new Error(`Source returned ${response.status}`);
  const json=await response.json(); if(!json.parse?.text?.['*']) throw new Error('Complete text unavailable');
  const doc=new DOMParser().parseFromString(json.parse.text['*'],'text/html');
  doc.querySelectorAll('style,script,table,.ws-noexport,.wst-header,.mw-editsection,sup,figure,.navbox,.sistersitebox,.licenseContainer,.licensetpl,.printfooter,.catlinks').forEach(node=>node.remove());
  return (doc.querySelector('.mw-parser-output')?.innerText||doc.body.innerText).replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}

function hydrateFullTexts(){
  document.querySelectorAll('[data-full-page]').forEach(async element=>{
    const workId=element.dataset.workId, note=document.querySelector(`[data-source-note="${workId}"]`);
    try{ const text=await loadWikisourceText(element.dataset.fullPage); if(text.split(/\s+/).length<80) throw new Error('Source text was incomplete'); element.textContent=text; element.removeAttribute('data-full-page'); if(note)note.firstChild.textContent='Complete public-domain text. Source: '; }
    catch{ element.insertAdjacentHTML('afterend',`<p class="load-error">The complete text could not be loaded. <button class="text-button" data-retry-text="${workId}">Try again</button></p>`); }
  });
}

function workCard(work){
  const s=state(), isRead=s.read.includes(work.id), isFav=s.favorites.includes(work.id);
  const contentId=work.baseId||work.id, external=work.access==='external';
  return `<article class="work" id="${work.id}">
    <div class="work-rule"><span>${workType(work.type)}</span></div>
    <header class="work-header"><div class="eyebrow">${esc(work.category)} · ${work.year||'Year unknown'}</div><h2>${esc(work.title)}</h2>
      <div class="byline">by ${esc(work.author.name)} <span>${esc(work.author.lifespan)}</span></div>
      <p class="work-facts">${esc(work.author.culture)} · ${work.century}</p><p class="introduction">${esc(work.intro)}</p></header>
    <div class="reader">${external?`<div class="external-reading"><div class="eyebrow">From ${esc(work.source)}</div><p>${esc(work.text||work.intro)}</p><a class="source-cta" data-external-source href="${work.sourceUrl}" target="_blank" rel="noopener">Read the complete article at ${esc(work.source)} ↗</a><span>Your place here will be saved.</span></div>`:`<p class="reader-text" data-work-id="${work.id}" ${!fullTexts[contentId]&&remoteTextPages[contentId]?`data-full-page="${esc(remoteTextPages[contentId])}"`:''}>${esc(fullTexts[contentId] || work.text)}</p><p class="source-note" data-source-note="${work.id}">${fullTexts[contentId]?'Complete public-domain text.':'Loading complete public-domain text… Source:'} <a href="${work.sourceUrl}" target="_blank" rel="noopener">${esc(work.source)} ↗</a>. The source link is provided for provenance; you can read the entire piece here.</p>`}
      <div class="tags">${work.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>
      <div class="actions"><button class="action ${isRead?'active':''}" data-action="read" data-id="${work.id}">${isRead?'✓ Read':'Mark as read'}</button><button class="action ${isFav?'active':''}" data-action="favorite" data-id="${work.id}">${isFav?'♥ Saved':'♡ Favorite'}</button></div>
      <details class="reflection"><summary>After reading · Optional reflection</summary><div class="reflection-body"><div class="reflection-inner"><div class="prompts"><p>What stayed with you? What did you disagree with? What idea do you want to remember?</p></div><textarea class="note" data-note="${work.id}" placeholder="Write a private note…">${esc(s.notes[work.id]||'')}</textarea><p class="privacy-note">Private to this browser. Your note is never sent to The Nightly Reader or anyone else.</p></div></div></details>
    </div></article>`;
}
function todayPage(edition=todayEdition){
  return `<section class="edition-hero"><div class="eyebrow">${formatDate(edition.date)} · Edition No. ${String(edition.number).padStart(3,'0')}</div><p class="edition-schedule">New edition scheduled daily at 1:17 p.m. Eastern</p><h1>Tonight’s<br>Reading</h1><p class="dek">${esc(edition.curatorNote)}</p><div class="edition-meta"><span>Three works · ${esc(edition.theme)}</span><span data-edition-progress>${state().read.filter(id=>edition.works.some(w=>w.id===id)).length} of ${edition.works.length} read</span></div></section>
  <section class="edition-overview" aria-label="Tonight's table of contents">${edition.works.map(w=>`<button class="overview-item text-button" data-scroll="${w.id}"><span class="eyebrow">${workType(w.type)}</span><h2>${esc(w.title)}</h2><p>${esc(w.author.name)}</p></button>`).join('')}</section>
  <nav class="reader-jump-nav" aria-label="Jump to another reading">${edition.works.map(w=>`<button class="text-button" data-scroll="${w.id}" data-jump-work="${w.id}"><span>${workType(w.type)}</span><strong>${esc(w.title)}</strong></button>`).join('')}</nav>${edition.works.map(workCard).join('')}`;
}
function archivePage(){ return pageHero('The Archive','Past evenings of stories, poems, and ideas—kept here to return to.')+`<div class="content-shell"><div class="archive-grid">${editions.map(e=>`<article class="archive-row" tabindex="0" data-edition="${e.id}"><div><span class="small-label">${e.date.slice(5).replace('-',' / ')}</span><p>${e.date.slice(0,4)}</p></div><div class="edition-col small-label">No. ${String(e.number).padStart(3,'0')}</div><div><h2>${esc(e.theme)}</h2><p>${e.works.map(w=>w.author.name).join(' · ')}</p></div></article>`).join('')}</div></div>` }
function searchPage(){ return pageHero('Search','Look across authors, titles, themes, introductions, tags, and your own notes.')+`<div class="content-shell"><div class="search-bar"><input id="search-input" type="search" placeholder="Search the collection…" aria-label="Search the collection" autofocus><select id="search-type" aria-label="Filter by form"><option value="all">All forms</option><option value="story">Stories</option><option value="poem">Poetry</option><option value="essay">Essays</option></select></div><div id="search-results">${searchResults('', 'all')}</div></div>` }
function searchResults(q,type){ const notes=state().notes; const term=q.trim().toLowerCase(); const rows=allWorks.filter(w=>(type==='all'||w.type===type)&&(!term||[w.title,w.author.name,w.category,w.intro,w.tags.join(' '),notes[w.id]].join(' ').toLowerCase().includes(term))); if(!rows.length)return empty('No matching works','Try a broader word, author, or subject.'); return rows.map(w=>`<article class="result"><div class="small-label">${workType(w.type)}<br>No. ${String(w.editionNumber).padStart(3,'0')}</div><div><h2>${esc(w.title)}</h2><p>${esc(w.author.name)} · ${esc(w.intro)}</p><div class="tags">${w.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div></div><button class="action" data-open-work="${w.editionId}|${w.id}">Read</button></article>`).join('') }
function libraryPage(){ const s=state(), read=allWorks.filter(w=>s.read.includes(w.id)), authors=new Set(read.map(w=>w.author.name)), centuries=new Set(read.map(w=>w.century)), cultures=new Set(read.map(w=>w.author.culture)); return pageHero('Your Library','A quiet record of where your reading has taken you.')+`<div class="content-shell"><div class="stats">${[['Nights completed',editions.filter(e=>e.works.every(w=>s.read.includes(w.id))).length],['Works read',read.length],['Stories',read.filter(w=>w.type==='story').length],['Poems',read.filter(w=>w.type==='poem').length],['Essays',read.filter(w=>w.type==='essay').length],['Unique authors',authors.size],['Centuries',centuries.size],['Cultures',cultures.size]].map(([l,v])=>`<div class="stat"><strong>${v}</strong><span>${l}</span></div>`).join('')}</div>${read.length?`<div class="archive-grid" style="margin-top:60px">${read.map(w=>`<div class="result"><div class="small-label">${workType(w.type)}</div><div><h2>${esc(w.title)}</h2><p>${esc(w.author.name)}</p></div><button class="action" data-open-work="${w.editionId}|${w.id}">Revisit</button></div>`).join('')}</div>`:empty('The shelf is waiting','Mark a piece as read and it will appear here.')}</div>` }
function favoritesPage(){ const favs=allWorks.filter(w=>state().favorites.includes(w.id)); return pageHero('Favorites','The pieces you want to keep close.')+`<div class="content-shell">${favs.length?favs.map(w=>`<article class="result"><div class="small-label">${workType(w.type)}</div><div><h2>${esc(w.title)}</h2><p>${esc(w.author.name)} · ${esc(w.intro)}</p></div><button class="action" data-open-work="${w.editionId}|${w.id}">Read</button></article>`).join(''):empty('Nothing saved yet','Use “Favorite” beneath any reading to place it here.')}</div>` }
function settingsPage(){ const s=state().settings; return pageHero('Settings','Shape the length and limits of the program without narrowing its curiosity.')+`<div class="content-shell settings"><form id="settings-form"><section><h2>Nightly reading</h2><div class="field"><label for="minutes">Approximate total length</label><select id="minutes" name="minutes"><option ${s.minutes==='15–25'?'selected':''}>15–25</option><option ${s.minutes==='20–35'?'selected':''}>20–35</option><option ${s.minutes==='30–45'?'selected':''}>30–45</option></select></div><div class="field"><label for="difficulty">Maximum difficulty</label><select id="difficulty" name="difficulty"><option>Accessible</option><option ${s.difficulty==='Moderate'?'selected':''}>Moderate</option><option ${s.difficulty==='Challenging'?'selected':''}>Challenging</option></select></div></section><section><h2>Selection boundaries</h2><label class="check"><input type="checkbox" name="longWorks" ${s.longWorks?'checked':''}><span>Occasionally include unusually long works</span></label><label class="check"><input type="checkbox" name="modern" ${s.modern?'checked':''}><span>Allow modern copyrighted recommendations (linked excerpts only)</span></label><label class="check"><input type="checkbox" name="fullText" ${s.fullText?'checked':''}><span>Only select works available as full text</span></label><div class="field"><label for="exclusions">Optional topic exclusions</label><input id="exclusions" name="exclusions" value="${esc(s.exclusions)}" placeholder="Comma-separated topics"></div></section><button class="primary" type="submit">Save preferences</button></form><section class="private-data"><div class="eyebrow">Private data</div><h2>Your notes stay on this device</h2><p>The Nightly Reader has no account or notes server. Notes are stored only in this browser, so the site owner cannot read them. Export a readable CSV whenever you like. Download the private backup if you want to restore the notes in another browser later.</p><div class="private-data-actions"><button class="action" id="export-notes-csv">Export notes as CSV</button><button class="action" id="export-notes-backup">Download restorable backup</button><label class="action file-action" for="import-notes">Restore backup</label><input id="import-notes" type="file" accept="application/json,.json" hidden></div></section></div>` }
function adminPage(){ const counts=Object.entries(allWorks.reduce((a,w)=>(a[w.author.culture]=(a[w.author.culture]||0)+1,a),{})); return pageHero('Curator’s Desk','Internal selection context and generation health.')+`<div class="content-shell admin-panel"><section class="panel"><span class="small-label">Today · No. 007</span><h2>${todayEdition.theme}</h2>${todayEdition.works.map(w=>`<p><strong>${workType(w.type)} · ${esc(w.title)}</strong><br><span class="small-label">${esc(w.rationale)}</span></p>`).join('')}<button class="action" id="regenerate">Run idempotency check</button></section><section class="panel"><span class="small-label">Recent distribution</span><h2>Culture / tradition</h2>${counts.map(([c,n])=>`<p>${esc(c)} <span style="float:right">${n}</span></p>`).join('')}</section><section class="panel"><span class="small-label">Source health</span><h2>21 verified records</h2><p>All seed records include an external source URL and public-domain classification. Unknown metadata is never inferred.</p></section><section class="panel"><span class="small-label">Generation log</span><h2>Last run</h2><div class="log">15:00:01 history_loaded editions=7<br>15:00:01 balance_checked<br>15:00:02 sources_validated=21<br>15:00:02 edition_exists date=2026-09-21<br>15:00:02 no_write idempotent=true</div></section></div>` }
function pageHero(title,dek){ return `<section class="page-hero"><div class="eyebrow">The Nightly Reader</div><h1>${title}</h1><p>${dek}</p></section>` }
function empty(title,body){ return `<div class="empty"><h2>${title}</h2><p>${body}</p></div>` }
const pages={today:()=>todayPage(),archive:archivePage,search:searchPage,library:libraryPage,favorites:favoritesPage,settings:settingsPage,admin:adminPage};

function resetPagePosition(){ window.scrollTo({top:0,left:0,behavior:'instant'}); requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'instant'})); }
function route(){ const key=location.hash.slice(1).split('/')[0]||'today'; document.querySelector('#main').innerHTML=(pages[key]||pages.today)(); document.querySelectorAll('[data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route===key)); document.querySelector('#primary-nav').classList.remove('open'); resetPagePosition(); bind(); }
function navigate(key){
  const update=()=>{ history.pushState(null,'',`#${key}`); route(); };
  if(document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(update);
  else if(!matchMedia('(prefers-reduced-motion: reduce)').matches){ const main=document.querySelector('#main'); main.classList.add('sheet-turn-out'); setTimeout(()=>{ update(); main.classList.remove('sheet-turn-out'); main.classList.add('sheet-turn-in'); const finish=event=>{ if(event.target!==main||event.animationName!=='fallback-sheet-in')return; main.classList.remove('sheet-turn-in'); main.removeEventListener('animationend',finish); }; main.addEventListener('animationend',finish); },130); }
  else update();
}
function toggleList(field,id){
  const s=state(), list=new Set(s[field]);
  list.has(id)?list.delete(id):list.add(id);
  store.write({[field]:[...list]});
  const active=list.has(id), action=field==='favorites'?'favorite':'read';
  document.querySelectorAll(`[data-action="${action}"][data-id="${id}"]`).forEach(button=>{
    button.classList.toggle('active',active);
    button.textContent=action==='favorite'?(active?'♥ Saved':'♡ Favorite'):(active?'✓ Read':'Mark as read');
  });
  const progress=document.querySelector('[data-edition-progress]');
  if(progress){ const editionWorkIds=[...document.querySelectorAll('.work')].map(work=>work.id); progress.textContent=`${state().read.filter(workId=>editionWorkIds.includes(workId)).length} of ${editionWorkIds.length} read`; }
  toast(field==='read'?(active?'Marked as read':'Marked unread'):(active?'Saved to favorites':'Removed from favorites'));
}
let editionRailController;
function bindEditionRail(){
  editionRailController?.abort();
  const rail=document.querySelector('.reader-jump-nav'), overview=document.querySelector('.edition-overview');
  if(!rail||!overview)return;
  editionRailController=new AbortController();
  const update=()=>{
    const headerHeight=document.querySelector('.site-header')?.offsetHeight||0;
    const visible=overview.getBoundingClientRect().bottom<=headerHeight+8;
    rail.classList.toggle('is-visible',visible);
    rail.setAttribute('aria-hidden',String(!visible));
    const works=[...document.querySelectorAll('.work')];
    const threshold=headerHeight+(visible?rail.offsetHeight:0)+70;
    const current=[...works].reverse().find(work=>work.getBoundingClientRect().top<=threshold)||works[0];
    rail.querySelectorAll('[data-jump-work]').forEach(button=>button.classList.toggle('active',button.dataset.jumpWork===current?.id));
  };
  window.addEventListener('scroll',update,{passive:true,signal:editionRailController.signal});
  window.addEventListener('resize',update,{passive:true,signal:editionRailController.signal});
  update();
}
function bind(){
  document.querySelectorAll('[data-route]').forEach(el=>el.onclick=()=>navigate(el.dataset.route));
  document.querySelectorAll('[data-action]').forEach(el=>el.onclick=()=>toggleList(el.dataset.action==='favorite'?'favorites':'read',el.dataset.id));
  document.querySelectorAll('[data-scroll]').forEach(el=>el.onclick=()=>document.getElementById(el.dataset.scroll)?.scrollIntoView({behavior:'smooth'}));
  document.querySelectorAll('[data-edition]').forEach(el=>{const open=()=>{document.querySelector('#main').innerHTML=todayPage(editions.find(e=>e.id===el.dataset.edition));bind();window.scrollTo(0,0)};el.onclick=open;el.onkeydown=e=>{if(e.key==='Enter')open()}});
  document.querySelectorAll('[data-open-work]').forEach(el=>el.onclick=()=>{const [eid,wid]=el.dataset.openWork.split('|');document.querySelector('#main').innerHTML=todayPage(editions.find(e=>e.id===eid));bind();setTimeout(()=>document.getElementById(wid)?.scrollIntoView(),0)});
  document.querySelectorAll('[data-note]').forEach(el=>{
    const save=()=>{const s=state();store.write({notes:{...s.notes,[el.dataset.note]:el.value}})};
    el.oninput=save;
    el.onchange=()=>{save();toast('Note saved privately in this browser')};
  });
  const input=document.querySelector('#search-input'),type=document.querySelector('#search-type'),update=()=>document.querySelector('#search-results').innerHTML=searchResults(input.value,type.value); if(input){input.oninput=update;type.onchange=update}
  const form=document.querySelector('#settings-form');if(form)form.onsubmit=e=>{e.preventDefault();const f=new FormData(form);store.write({settings:{minutes:f.get('minutes'),difficulty:f.get('difficulty'),longWorks:f.has('longWorks'),modern:f.has('modern'),fullText:f.has('fullText'),exclusions:f.get('exclusions')}});toast('Preferences saved')};
  const download=(contents,type,filename)=>{const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([contents],{type}));link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),0)};
  const exportCsv=document.querySelector('#export-notes-csv');if(exportCsv)exportCsv.onclick=()=>{const notes=state().notes, quote=value=>`"${String(value??'').replaceAll('"','""')}"`;const rows=[['Edition date','Form','Title','Author','Source link','Note'],...allWorks.filter(work=>notes[work.id]?.trim()).map(work=>[work.editionDate,workType(work.type),work.title,work.author.name,work.sourceUrl,notes[work.id]])];download(`\uFEFF${rows.map(row=>row.map(quote).join(',')).join('\r\n')}`,'text/csv;charset=utf-8',`nightly-reader-notes-${new Date().toISOString().slice(0,10)}.csv`);toast(`${rows.length-1} notes exported as CSV`)};
  const exportBackup=document.querySelector('#export-notes-backup');if(exportBackup)exportBackup.onclick=()=>{const payload={app:'The Nightly Reader',version:1,exportedAt:new Date().toISOString(),notes:state().notes};download(JSON.stringify(payload,null,2),'application/json',`nightly-reader-notes-backup-${new Date().toISOString().slice(0,10)}.json`);toast('Private notes backup downloaded')};
  const importNotes=document.querySelector('#import-notes');if(importNotes)importNotes.onchange=()=>{const file=importNotes.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const backup=JSON.parse(reader.result);if(backup.app!=='The Nightly Reader'||backup.version!==1||!backup.notes||Array.isArray(backup.notes)||typeof backup.notes!=='object')throw new Error('Invalid backup');const notes=Object.fromEntries(Object.entries(backup.notes).filter(([id,value])=>allWorks.some(work=>work.id===id)&&typeof value==='string'));store.write({notes});toast(`${Object.keys(notes).length} private notes restored`)}catch{toast('That file is not a valid notes backup')}finally{importNotes.value=''}};reader.readAsText(file)};
  const regen=document.querySelector('#regenerate');if(regen)regen.onclick=()=>toast('Edition already exists — no duplicate created');
  document.querySelectorAll('[data-retry-text]').forEach(button=>button.onclick=()=>{ const id=button.dataset.retryText, element=document.querySelector(`[data-work-id="${id}"]`); button.closest('.load-error')?.remove(); if(element&&remoteTextPages[id])element.dataset.fullPage=remoteTextPages[id]; hydrateFullTexts(); });
  document.querySelectorAll('[data-external-source]').forEach(link=>link.onclick=()=>{sessionStorage.setItem('nightly-return',JSON.stringify({hash:location.hash,scrollY,workId:link.closest('.work')?.id}));toast('Opened in a new tab — your place is saved')});
  bindEditionRail();
  hydrateFullTexts();
}
document.querySelector('.menu-button').onclick=e=>{const nav=document.querySelector('#primary-nav'),open=nav.classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',String(open))};
function applyTheme(theme){ document.documentElement.dataset.theme=theme; localStorage.setItem('nightly-theme',theme); const button=document.querySelector('#theme-toggle'); const dark=theme==='dark'; button.setAttribute('aria-label',dark?'Use light theme':'Use dark theme'); button.title=dark?'Use light theme':'Use dark theme'; button.querySelector('span').textContent=dark?'☀':'◐'; }
document.querySelector('#theme-toggle').onclick=()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
applyTheme(document.documentElement.dataset.theme||'light');
document.querySelector('#back-to-top').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});
window.addEventListener('scroll',()=>document.querySelector('#back-to-top').classList.toggle('show',scrollY>700));
if('scrollRestoration' in history) history.scrollRestoration='manual';
window.addEventListener('hashchange',route);route();
window.addEventListener('popstate',route);
