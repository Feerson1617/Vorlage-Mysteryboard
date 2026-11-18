import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile}from'node:fs/promises';
import{resolve,extname}from'node:path';
const root=process.cwd(),out=process.argv[2]||'/workspace/mysteryboard-ocr-evidence';await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!path.startsWith(root+'/'))throw Error();const b=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.png':'image/png'})[extname(path)]||'application/octet-stream');res.end(b)}catch{res.writeHead(404).end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try {
 const context=await browser.newContext({hasTouch:true}),page=await context.newPage();page.setDefaultTimeout(12000);page.on('console',m=>console.log('CONSOLE',m.text()));page.on('pageerror',e=>console.log('ERROR',e.message));
 try {await page.goto(origin+'/artifacts/ocr-author/launch.html');console.log('Loaded');const ui=page.frames().find(f=>f.url().endsWith('/app.html'));console.log('Frame',!!ui);await ui.getByRole('button',{name:'Lehrkräfteeditor',exact:true}).tap();console.log('Teacher');await ui.getByLabel('Lehrkraftkürzel',{exact:true}).fill('AB');await ui.getByRole('button',{name:'Lehrkräftemodus öffnen',exact:true}).tap();console.log('Editor');await ui.getByRole('button',{name:'Foto oder Scan importieren',exact:true}).tap();console.log('Import');await ui.getByLabel('Foto oder Scan',{exact:true}).setInputFiles('tests/fixtures/ocr/Gerades-Foto.jpg');console.log('File');await ui.getByRole('button',{name:'Kartengrenzen und Text erkennen',exact:true}).tap();console.log('OCR');await ui.locator('.import-step-body').waitFor({state:'visible'});await page.waitForTimeout(15000);console.log((await ui.locator('body').innerText()).slice(-4000));}
 finally{await page.screenshot({path:out+'/smoke.png',fullPage:true});}
 }finally{await browser.close();server.close()}
