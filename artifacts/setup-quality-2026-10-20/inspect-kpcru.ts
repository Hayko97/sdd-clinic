import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setupOverview, overviewCoverage } from '../../src/server/setup-overview.js';
import { hash, redact } from '../../src/server/util.js';
const root='/Users/ashugh/Documents/Github/kpcru';
const manifest=JSON.parse(await readFile(join(root,'artifacts/sdd-audit-2026-10-20/source-manifest.json'),'utf8'));
const paths=[...new Set([...Object.keys(manifest.files),'README.md'])].filter(p=>!['package-lock.json'].includes(p));
const files=[];
for(const path of paths){
 const text=await readFile(join(root,path),'utf8');
 files.push({path,content:String(redact(text)),hash:hash(text),lines:text.split('\n').length});
}
const inventory={files,excluded:[],fingerprint:hash(files.map(f=>f.hash).join('\n'))};
const chunks=setupOverview(inventory);
const report={scope:'Read-only replay of the earlier 131-file audit source manifest plus README, excluding dependency lockfile. No project files changed or provider called.',files:files.length,selectedFiles:new Set(chunks.map(c=>c.path)).size,sourceCharacters:chunks.reduce((n,c)=>n+c.content.length,0),selected:chunks.map(({content,...c})=>c),coverage:overviewCoverage(inventory,chunks)};
await writeFile('artifacts/setup-quality-2026-10-20/kpcru-selection.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({files:report.files,selectedFiles:report.selectedFiles,sourceCharacters:report.sourceCharacters,classes:['UI','tests','SQL','services'].map(label=>({label,paths:[...new Set(chunks.filter(c=>label==='UI'?/\.tsx$/.test(c.path):label==='tests'?/test|spec/.test(c.path):label==='SQL'?/\.sql$/.test(c.path):/services|api|lib/.test(c.path)).map(c=>c.path))]}))}));
