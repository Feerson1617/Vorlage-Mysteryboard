import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,relative,sep,extname} from 'node:path';
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});
const native=resolve(process.argv[3]);
// Reuse the existing unchanged player acceptance, selecting the Windows Python
// executable only. All actual SCO interactions and comparisons remain intact.
const code=(await readFile('qa/studio/player-workflow.mjs','utf8')).replace('execFileSync("python3",','execFileSync("python",');
const helper=join(out,'player-workflow.mjs');await writeFile(helper,code);
const {playerWorkflow}=await import(pathToFileURL(helper));
const server=createServer(async(req,res)=>{try{
 const name=decodeURIComponent(req.url.split('?')[0]).replace(/^\/qa-evidence\//,'');
 const file=resolve(out,name),rel=relative(out,file);
 assert(rel&&!rel.startsWith('..'+sep)&&rel!=='..'&&!resolve(rel).startsWith('\\'));
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.png':'image/png','.json':'application/json'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
const proofs=[];
try{
 for(const [file,n,name]of [['Windows-5-SCORM.zip',5,'Windows-Neu5'],...[5,12,16,20,60].map(n=>[`Studio-${n}-SCORM.zip`,n,'Windows-'+n])]){
  proofs.push(await playerWorkflow(browser,origin,out,join(native,file),name,n));
 }
 await writeFile(join(out,'Studentenpruefung.json'),JSON.stringify({passed:true,proofs,engine:browser.version()},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r))}
