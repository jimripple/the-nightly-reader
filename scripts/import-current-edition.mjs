import { writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const decode = value => value
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<sup[\s\S]*?<\/sup>/gi, '')
  .replace(/<table[\s\S]*?<\/table>/gi, '')
  .replace(/<div[^>]+class="[^"]*(?:ws-noexport|wst-header)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
  .replace(/<br\s*\/?\s*>/gi, '\n')
  .replace(/<\/p>|<\/div>|<\/li>|<\/h\d>/gi, '\n\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;|&#160;/g, ' ')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

async function wiki(page) {
  const url = `https://en.wikisource.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=text&format=json&origin=*`;
  const json = await (await fetch(url)).json();
  if (!json.parse?.text?.['*']) throw new Error(`Missing Wikisource page: ${page}`);
  return decode(json.parse.text['*']);
}

const wellsRaw = (await (await fetch('https://www.gutenberg.org/cache/epub/27365/pg27365.txt')).text()).replace(/\r/g, '');
const wellsStart = wellsRaw.indexOf('\nTHE STAR\n');
const wellsEnd = wellsRaw.indexOf('\nA Story of the Stone Age', wellsStart);
const wells = wellsRaw.slice(wellsStart + 10, wellsEnd).replace(/\n{3,}/g, '\n\n').trim();

const texts = {
  s7: wells,
  p7: await wiki('The Poetical Works of John Keats/To Autumn'),
  e7: await wiki('The Essays of Francis Bacon/L Of Studies'),
};

const muirHtml=execFileSync('curl',['-L','-sS','https://www.yosemite.ca.us/john_muir_writings/our_national_parks/chapter_10.html'],{encoding:'utf8'});
const muirChapter=muirHtml.match(/<!--begin chapter-->([\s\S]*?)<!--end chapter-->/i)?.[1];
if(!muirChapter)throw new Error('Could not isolate The American Forests');
texts.e4=decode(muirChapter);

await mkdir(new URL('../content/', import.meta.url), { recursive: true });
await writeFile(new URL('../content/full-texts.js', import.meta.url), `// Generated from the cited public-domain sources.\nexport const fullTexts = ${JSON.stringify(texts, null, 2)};\n`);
console.log(`Imported ${Object.keys(texts).length} complete public-domain texts.`);
