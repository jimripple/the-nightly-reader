import { cp, mkdir, rm } from 'node:fs/promises';
const output = new URL('./dist/', import.meta.url);
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for (const file of ['index.html','styles.css','app.js','data.js','generator.js','edition-status.js']) await cp(new URL(`./${file}`,import.meta.url),new URL(`./dist/${file}`,import.meta.url));
await cp(new URL('./content/',import.meta.url),new URL('./dist/content/',import.meta.url),{recursive:true});
console.log('✓ Static production bundle written to dist/');
