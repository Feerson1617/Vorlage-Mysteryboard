import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const path='studio/dist/studio/index.html';
const original=await readFile(path,'utf8');
// Only a visible platform-specific shortcut hint in the generated Windows
// bundle. No protected React source or application logic is edited.
assert(original.includes('⌘S'));
const html=original.replaceAll('⌘S','Strg+S').replaceAll('⌘O','Strg+O');
await writeFile(path,html);
const securityPath='studio/dist/studio/security.json';
const security=JSON.parse(await readFile(securityPath,'utf8'));
const hashes=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>"'sha256-"+createHash('sha256').update(m[1]).digest('base64')+"'");
assert.equal((security.csp.match(/'sha256-[^']+'/g)||[]).length,hashes.length);
let index=0;security.csp=security.csp.replace(/'sha256-[^']+'/g,()=>hashes[index++]);
await writeFile(securityPath,JSON.stringify(security,null,2)+'\n');
await writeFile('windows/evidence/ui-platform-adaptation.json',JSON.stringify({sourceFilesChanged:0,adaptation:'visible Command-S/O hint to Strg+S/O in Windows build output; CSP script hashes updated',originalSHA256:createHash('sha256').update(original).digest('hex'),windowsSHA256:createHash('sha256').update(html).digest('hex')},null,2));
