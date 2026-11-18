import { _electron, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fixtures } from "../fixtures.mjs";
import { button } from "../controls.mjs";
const [folder,version] = process.argv.slice(2),out=resolve(folder);
await mkdir(out,{recursive:true});
const [doc]=await fixtures(out,[31]);
const app=await _electron.launch({executablePath:process.env.STUDIO_EXEC,args:["--user-data-dir="+join(out,"profile")]});
try {
 const page=await app.firstWindow();
 const appVersion=await app.evaluate(({app})=>app.getVersion());
 assert.equal(appVersion,version);
 await app.evaluate(({dialog},p)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[p]});},doc.path);
 await button(page,"Mystery öffnen").click();
 await expect(page.locator(".studio-board [data-card]")).toHaveCount(31);
 const sizes=[];
 for(const [width,height] of [[1280,800],[1440,900],[1567,959],[1024,768]]){
   const native=await app.evaluate(async({BrowserWindow,screen},size)=>{
     const win=BrowserWindow.getAllWindows()[0], d=screen.getDisplayMatching(win.getBounds());
     win.setBounds({x:d.workArea.x,y:d.workArea.y,...size},false);
     await new Promise(r=>setTimeout(r,250));
     return {window:win.getBounds(),content:win.getContentBounds(),display:d.bounds,workArea:d.workArea,scaleFactor:d.scaleFactor};
   },{width,height});
   await button(page,"Alle Karten anzeigen").click();
   const metrics=await page.evaluate(()=>{
     const box=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};};
     const board=document.querySelector(".studio-board svg.board");
     const controls=[...document.querySelectorAll("button")].filter(e=>e.offsetWidth && e.offsetHeight && ["Karte hinzufügen","Importieren","Mystery gestalten","Exportieren"].includes(e.textContent.trim())).map(e=>({label:e.textContent.trim(),bounds:box(e),fontSize:getComputedStyle(e).fontSize}));
     return {inner:[innerWidth,innerHeight],outer:[outerWidth,outerHeight],dpr:devicePixelRatio,board:box(board),controls};
   });
   const png=await page.screenshot();
   const pixels=[png.readUInt32BE(16),png.readUInt32BE(20)];
   const filename=`${version}-Fenster-${native.window.width}x${native.window.height}-Inhalt-${pixels.join("x")}-Ziel-${width}x${height}.png`;
   await writeFile(join(out,filename),png);
   assert.deepEqual(metrics.inner,[native.content.width,native.content.height]);
   assert.deepEqual(pixels,metrics.inner.map(x=>Math.round(x*metrics.dpr)));
   assert(metrics.board.height>0 && metrics.board.width>0);
   assert.equal(metrics.controls.length,4);
   for(const {bounds:b} of metrics.controls) assert(b.width>0&&b.height>0&&b.x>=0&&b.y>=0&&b.x+b.width<=metrics.inner[0]+1&&b.y+b.height<=metrics.inner[1]+1);
   sizes.push({requestedWindow:[width,height],exact:native.window.width===width&&native.window.height===height,...native,...metrics,pixels,filename});
 }
 await writeFile(join(out,"Fenster-"+version+".json"),JSON.stringify({version,arch:process.arch,sizes},null,2));
}finally{await app.close();}
