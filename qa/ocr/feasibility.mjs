import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile}from'node:fs/promises';
import{resolve,extname}from'node:path';
const root=process.cwd(),out=process.argv[2]||'/workspace/mysteryboard-ocr-evidence';await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!path.startsWith(root+'/'))throw Error();const b=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.png':'image/png'})[extname(path)]||'application/octet-stream');res.end(b)}catch{res.writeHead(404).end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{const context=await browser.newContext();const page=await context.newPage();const requests=[],errors=[];page.on('request',r=>requests.push({url:r.url(),method:r.method()}));page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
await page.goto(origin+'/artifacts/ocr-author/launch.html');
const cdp=await browser.newBrowserCDPSession();let rssPeak=0,rssAfter=null;const samples=[];let sampling=false;
const sample=async()=>{if(sampling)return;sampling=true;try{const {processInfo}=await cdp.send('SystemInfo.getProcessInfo');let rss=0;for(const p of processInfo){try{const status=await readFile(`/proc/${p.id}/status`,'utf8'),match=/VmRSS:\s+(\d+) kB/.exec(status);rss+=match?Number(match[1])*1024:0}catch{}}rssPeak=Math.max(rssPeak,rss);rssAfter=rss;samples.push({ms:Date.now(),rss})}finally{sampling=false}};
await sample();const rssBefore=rssAfter;const sampler=setInterval(()=>void sample(),200);
const result=await page.frameLocator('#app').locator('body').count().catch(()=>0);
const frame=page.frames().find(f=>f.url().endsWith('/app.html'));if(!frame)throw Error('No real SCO app');
const image=await readFile('tests/fixtures/ocr/Machbarkeit.png');
const evidence=await frame.evaluate(async({bytes})=>{
 const start=performance.now();const iframe=document.createElement('iframe');iframe.hidden=true;iframe.src='ocr/host.html';document.body.append(iframe);let id=0;
 const request=(type,extra={})=>new Promise((resolve,reject)=>{const n=++id;const listener=e=>{if(e.source!==iframe.contentWindow||e.data.id!==n)return;if(e.data.type==='done'){removeEventListener('message',listener);resolve(e.data.data)}if(e.data.type==='error'){removeEventListener('message',listener);reject(Error(e.data.message))}};addEventListener('message',listener);iframe.contentWindow.postMessage({id:n,type,...extra},location.origin)});
 await new Promise(r=>addEventListener('message',function on(e){if(e.source===iframe.contentWindow&&e.data.type==='ready'){removeEventListener('message',on);r()}}));
 await request('start');const ready=performance.now();const data=await request('recognize',{bytes});const finished=performance.now();iframe.contentWindow.postMessage({type:'dispose'},location.origin);iframe.remove();
 return{startupMs:ready-start,recognitionMs:finished-ready,text:data.text,confidence:data.confidence,blocks:data.blocks,heap:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null};
},{bytes:[...image]});
await page.waitForTimeout(100);const workersAfter=page.workers().length;
await frame.evaluate(async()=>{const f=document.createElement('iframe');f.hidden=true;f.src='ocr/host.html';document.body.append(f);await new Promise(r=>addEventListener('message',function on(e){if(e.source===f.contentWindow&&e.data.type==='ready'){removeEventListener('message',on);r()}}));f.contentWindow.postMessage({type:'start',id:100},location.origin);await new Promise(r=>setTimeout(r,50));f.remove()});await page.waitForTimeout(500);
clearInterval(sampler);await sample();const e={memory:{rssBefore,rssPeak,rssAfter,measurement:"sum of browser-owned process resident sets; shared pages may be counted more than once; not a WASM-only or iPad measurement",samples},...evidence,workersAfter,workersAfterStartupAbort:page.workers().length,requests,errors,browser:browser.version(),context:'actual packaged SCORM iframe; local static files; no WAN',result};
await writeFile(out+'/feasibility.json',JSON.stringify(e,null,2));
if(!e.text.includes('Müller')||!e.text.includes('1912')||!e.blocks?.length||workersAfter||e.workersAfterStartupAbort||requests.some(r=>!r.url.startsWith(origin))||errors.length)throw Error('Feasibility failed; see evidence');console.log(JSON.stringify({startupMs:e.startupMs,recognitionMs:e.recognitionMs,workersAfter,workersAfterStartupAbort:e.workersAfterStartupAbort,text:e.text},null,2));
}finally{await browser.close();server.close()}
