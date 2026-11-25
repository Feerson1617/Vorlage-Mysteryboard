import assert from "node:assert/strict";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {chromium,webkit,expect} from "@playwright/test";
import {unzipSync} from "fflate";
import {host} from "./web-host.mjs";
const [folder,destination,phase]=process.argv.slice(2),old=phase==="before";
const out=resolve(destination), archive=unzipSync(await readFile(join(folder,"Wasser-SCORM.zip")));
await mkdir(join(out,"sco"),{recursive:true});
for(const [k,v] of Object.entries(archive)){assert(!k.includes("/"));await writeFile(join(out,"sco",k),v);}
const server=await host(out),url=server.origin+"/qa-evidence/sco/launch.html",results=[];
try{
 for(const [name,type,path] of [["Chromium",chromium,process.env.CHROMIUM_PATH],["WebKit",webkit,process.env.WEBKIT_PATH]]){
  const browser=await type.launch({executablePath:path||undefined});
  try{
   for(const [level,title] of [["ESA","Wasser Wege"],["AHR","Wasser im Einzugsgebiet"]]){
    const page=await browser.newPage({viewport:{width:1024,height:768}});page.on("dialog",d=>d.accept().catch(()=>{}));
    await page.goto(url);const ui=page.frameLocator("iframe"),button=n=>ui.getByRole("button",{name:n,exact:true});
    const frame=()=>page.frames().find(f=>f.url().endsWith("/app.html"));
    const stored=()=>frame().evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith("mysteryboard.028.[")).map(k=>JSON.parse(sessionStorage[k])));
    const row=async()=> (await stored())[0];
    const pick=async file=>{await button("Menü").click();await button("Original-PNG öffnen").click();await ui.getByLabel("Schüler-Sicherung").setInputFiles(file);};
    const card=ui.locator('[data-card="1"]'),png=join(folder,"Gruppe 3_"+title+".png");
    await button(level).click();await ui.getByLabel("Gruppenname",{exact:true}).fill("Team Birke");await button("Beginnen").click();
    await card.press("Enter");await button("Text bearbeiten").click();await ui.getByLabel("Kartentext",{exact:true}).fill("Neuer Befund aus unserer Gruppe.");await button("Änderungen übernehmen").click();await button("Schließen").click();
    await expect(ui.locator(".recovery-status")).toContainText("Automatisch gespeichert");
    const prior=await row();await pick(png);
    if(!old){await expect(ui.getByRole("dialog",{name:"Arbeitsstand ersetzen?"})).toContainText("Team Birke");await button("Bisherige Arbeit behalten").click();
      assert.deepEqual((await row()).work,prior.work);await page.reload();await expect(card).toContainText("Neuer Befund");
      await pick(png);await button("Ausgewählte PNG öffnen").click();}
    await expect.poll(async()=>(await row()).work.team).toBe("Gruppe 3");
    const imported=(await row()).work;assert.notDeepEqual(imported.textEdits,prior.work.textEdits);
    if(!old){await pick(png);await expect(ui.getByRole("dialog")).toHaveCount(0);await page.reload();await expect(card).toBeVisible();assert.deepEqual((await row()).work,imported);}
    results.push({name,engine:browser.version(),level,prior:prior.work.team,opened:imported.team,confirmation:!old});await page.close();
   }
  }finally{await browser.close();}
 }
 await writeFile(join(out,phase+".json"),JSON.stringify(results,null,2));
}finally{server.close();}
