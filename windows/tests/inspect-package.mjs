import {extractFile,listPackage} from '@electron/asar';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const dir=resolve(process.argv[2]),out=resolve(process.argv[3]);await mkdir(out,{recursive:true});
const exe=await readFile(join(dir,'MysteryBoard Studio.exe'));assert.equal(exe.toString('ascii',0,2),'MZ');const pe=exe.readUInt32LE(0x3c);assert.equal(exe.toString('ascii',pe,pe+4),'PE\x00\x00');assert.equal(exe.readUInt16LE(pe+4),0x8664);
const asar=join(dir,'resources/app.asar');const files=listPackage(asar).map(n=>n.replaceAll('\\','/').replace(/^\//,''));
for(const forbidden of ['node_modules/','tests/','qa/','studio/ui/','studio/player/'])assert(!files.some(x=>x.startsWith(forbidden)),forbidden);
const matched=[];
for(const name of ['studio/electron/main.cjs','studio/electron/preload.cjs','windows/bootstrap.cjs','windows/squirrel.cjs','studio/dist/studio/index.html','studio/dist/studio/security.json','studio/dist/studio/player-template.html']){
 const a=extractFile(asar,name),b=await readFile(join('windows/stage',name));assert(a.equals(b),'ASAR differs from staged file: '+name);matched.push({file:name,bytes:a.length,sha256:createHash('sha256').update(a).digest('hex')});
}
const ocr=[];
for(const name of ['host.html','host.js','tesseract.min.js','worker.min.js','tesseract-core-lstm.wasm.js','deu.traineddata.gz','MODEL-LICENSE.txt','Tesseract-LICENSE.txt','Core-LICENSE.txt']){
 const bytes=extractFile(asar,'studio/dist/studio/ocr/'+name);assert(bytes.length>100);ocr.push({name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const player=extractFile(asar,'studio/dist/studio/player-template.html').toString();assert(player.includes('mysteryboard-licenses'));assert(!player.includes('tesseract.min.js'));
await writeFile(join(out,'Paket-Inhalt.json'),JSON.stringify({passed:true,exeMachine:'PE32+ AMD64',files:files.length,matched,ocr,externalRuntimeNeeded:false},null,2));
console.log('Actual PE x64, complete ASAR, packaged OCR/model and frozen main/preload verified');
