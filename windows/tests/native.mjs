// Drives the real packaged Windows application. Only native dialog selections
// and deliberate error responses are supplied by the harness; no app IPC,
// import, OCR, filesystem, PDF or export implementation is replaced.
import assert from 'node:assert/strict';
import { _electron, expect } from '@playwright/test';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fixtures,canonical} from '../../qa/studio/fixtures.mjs';
import {button as b,openExports,closeExports,saveProject,chooseImportCard,correction,simpleImport} from '../../qa/studio/controls.mjs';
import {scanWorkflow} from '../../qa/studio/scan-workflow.mjs';
import {unzipSync} from 'fflate';
assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
const [executableArgument,outArgument,mode='full']=process.argv.slice(2);
const executable=resolve(executableArgument),out=resolve(outArgument);
await mkdir(out,{recursive:true});await mkdir(join(out,'Screenshots'),{recursive:true});
const checks=[],requests=[],errors=[],dialogs=[];
let app,page,prefs;
const record=(name,detail={})=>{checks.push({name,passed:true,...detail});console.log('PASS '+name);};
const exists=async p=>{try{return (await stat(p)).size}catch{return 0}};
const screenshot=async name=>page.screenshot({path:join(out,'Screenshots',name+'.png')});
async function start(suffix='',scale=1){
 app=await _electron.launch({executablePath:executable,args:['--user-data-dir='+join(out,'profile'+suffix),'--force-device-scale-factor='+scale],timeout:60000});
 page=await app.firstWindow();page.setDefaultTimeout(30000);
 page.on('filechooser',()=>{});
 page.on('pageerror',e=>errors.push(e.message));
 app.context().on('request',r=>{if(/^https?:/i.test(r.url()))requests.push(r.url())});
 // Chromium's offline network emulation is active in addition to the shipped
 // CSP and network allowlist. Custom-scheme local assets continue to work.
 await app.context().setOffline(true);
 await expect(page.getByRole('heading',{name:'MysteryBoard Studio',exact:true})).toBeVisible();
 prefs=await app.evaluate(({app,BrowserWindow,screen})=>({
  platform:process.platform,arch:process.arch,version:app.getVersion(),electron:process.versions.electron,chromium:process.versions.chrome,
  isPackaged:app.isPackaged,exe:process.execPath,pid:process.pid,argv:process.argv,sourceCommit:process.env.GITHUB_SHA||null,
  operatingSystem:process.getBuiltinModule('os').version(),release:process.getBuiltinModule('os').release(),
  preferences:BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(),
  displays:screen.getAllDisplays(),windows:BrowserWindow.getAllWindows().length,
 }));
 assert.equal(prefs.platform,'win32');assert.equal(prefs.arch,'x64');assert.equal(prefs.version,'0.2.0');assert.equal(prefs.electron,'45.3.3');
 assert(prefs.isPackaged);assert.equal(prefs.preferences.sandbox,true);assert.equal(prefs.preferences.contextIsolation,true);assert.equal(prefs.preferences.nodeIntegration,false);assert.equal(prefs.preferences.webSecurity,true);
 assert(!prefs.argv.includes('--no-sandbox'));assert.equal(await page.evaluate(()=>typeof require),'undefined');
 const processInfo=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command',`Get-CimInstance Win32_Process -Filter "ProcessId=${prefs.pid}" | Select-Object ProcessId,ExecutablePath,CommandLine | ConvertTo-Json -Compress`],{encoding:'utf8'}));
 assert.equal(processInfo.ExecutablePath.toLowerCase(),executable.toLowerCase());
 record('real Windows x64 packaged Electron process and sandbox',{processInfo,scale});
 await app.evaluate(({dialog})=>{
  globalThis.qaDialogs=[];globalThis.qaSavePath=null;globalThis.qaOpenPath=null;globalThis.qaWarning=1;
  const answer=(...args)=>{const o=args.at(-1);globalThis.qaDialogs.push({type:'message',message:o.message,buttons:o.buttons});return{response:o.message==='Ungesicherte Änderungen'?globalThis.qaWarning:0,checkboxChecked:false}};
  dialog.showMessageBox=async(...args)=>answer(...args);dialog.showMessageBoxSync=(...args)=>answer(...args).response;
  dialog.showSaveDialog=async(...args)=>{const o=args.at(-1);globalThis.qaDialogs.push({type:'save',title:o.title,defaultPath:o.defaultPath});return globalThis.qaSavePath?{canceled:false,filePath:globalThis.qaSavePath}:{canceled:true}};
  dialog.showOpenDialog=async()=>{globalThis.qaDialogs.push({type:'open'});return globalThis.qaOpenPath?{canceled:false,filePaths:[globalThis.qaOpenPath]}:{canceled:true,filePaths:[]}};
 });
 await screenshot('Start'+suffix);
}
async function stop(){
 if(!app)return;
 dialogs.push(...await app.evaluate(()=>globalThis.qaDialogs).catch(()=>[]));
 await app.close();app=null;
}
async function saveTo(path,saveAs=false){
 await app.evaluate((_,path)=>globalThis.qaSavePath=path,path);
 await saveProject(page,saveAs);await expect.poll(()=>exists(path)).toBeGreaterThan(10);
 return JSON.parse(await readFile(path,'utf8'));
}
async function nativeKey(id){
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.show();w.focus()});
 await expect.poll(()=>app.evaluate(({Menu},id)=>Menu.getApplicationMenu().getMenuItemById(id).enabled,id)).toBe(true);
 await page.evaluate(()=>{globalThis.qaCommands=[];globalThis.qaUnsubscribe?.();globalThis.qaUnsubscribe=window.mysteryStudio.onCommand(c=>globalThis.qaCommands.push(c))});
 execFileSync('powershell.exe',['-NoProfile','-File','windows/tests/keys.ps1','-ApplicationProcessId',String(prefs.pid),'-Keys',id==='project-open'?'^o':id==='project-save-as'?'^+s':'^s'],{stdio:'inherit'});
 await expect.poll(()=>page.evaluate(()=>globalThis.qaCommands)).toEqual([id.slice(8)]);
}
async function open(path,n){
 await app.evaluate((_,path)=>globalThis.qaOpenPath=path,path);
 await nativeKey('project-open');await expect(page.locator('.studio-board [data-card]')).toHaveCount(n);
}
async function scorm(path){
 await app.evaluate((_,path)=>globalThis.qaSavePath=path,path);
 await openExports(page);await b(page,'Für itslearning exportieren').click();
 await expect.poll(()=>exists(path)).toBeGreaterThan(1000);
 const files=unzipSync(new Uint8Array(await readFile(path)));
 assert.deepEqual(Object.keys(files).sort(),['app.html','imsmanifest.xml','launch.html','session.js']);
 const html=Buffer.from(files['app.html']).toString();
 for(const s of ['Lehrkräftemodus öffnen','tesseract.min.js','Kartengrenzen und Text erkennen'])assert(!html.includes(s));
 assert(html.length<10_000_000);await closeExports(page);return path;
}
async function viewports(name){
 const rows=[];
 for(const [width,height]of [[1280,800],[1024,768],[800,600]]){
  await app.evaluate(({BrowserWindow},s)=>BrowserWindow.getAllWindows()[0].setContentSize(s[0],s[1]),[width,height]);
  await expect.poll(()=>page.evaluate(()=>[innerWidth,innerHeight])).toEqual([width,height]);
  const layout=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scale:devicePixelRatio}));
  assert(layout.scrollWidth<=width+1,JSON.stringify(layout));
  const scope=await page.getByRole('dialog').count()?page.getByRole('dialog').last():page;
  const reachable=[];
  for(const name of ['Neues Mystery erstellen','Mystery öffnen','Karte hinzufügen','Importieren','Mystery gestalten','Exportieren','Weiter zur Übernahme','Erkennung korrigieren','Bearbeitbares Mystery sichern','Als Druck-PDF speichern','Für itslearning exportieren','Als Bild exportieren','Karte übernehmen']){
   const control=b(scope,name);if(await control.count()===1&&await control.isVisible()){
    await control.scrollIntoViewIfNeeded();const box=await control.boundingBox();assert(box.x>=-1&&box.y>=-1&&box.x+box.width<=width+1&&box.y+box.height<=height+1,`Unreachable ${name}: ${JSON.stringify(box)}`);reachable.push(name);
   }
  }
  layout.reachableButtons=reachable;
  await screenshot(`${name}-${width}x${height}`);rows.push(layout);
 }
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1280,800));
 record(name+' responsive native windows', {viewports:rows});
}
async function begin(){
 await b(page,'Neues Mystery erstellen').click();await page.getByLabel('Lehrkraftkürzel',{exact:true}).fill('WIN');await b(page,'Mystery erstellen').click();
 await page.getByLabel('Mystery-Titel',{exact:true}).fill('Windows – Küste, 1,5 °C');
 assert.deepEqual(await page.getByRole('navigation',{name:'Mystery bearbeiten'}).getByRole('button').allTextContents(),['Karte hinzufügen','Importieren','Mystery gestalten','Exportieren']);
}
async function importFile(path,count){
 await b(page,'Importieren').click();await page.getByLabel('Mystery-Datei',{exact:true}).setInputFiles(resolve(path));
 await expect(page.locator('.studio-import-summary')).toContainText(count+' Karten erkannt',{timeout:120000});
 await expect(page.locator('.import-step-body')).toBeEnabled({timeout:120000});
}
async function take(newMystery=true){
 await b(page,'Weiter zur Übernahme').click();
 if(newMystery)await page.getByRole('radio',{name:'Neues Mystery aus dem Dokument erstellen',exact:true}).check();
 await page.getByRole('checkbox',{name:/Ich habe Texte/}).check();await b(page,'Karten übernehmen').click();
}
try{
 await start();await viewports('Start');await begin();
 const projectPath=join(out,'Müller – Projekt 中文.mysteryboard');
 await saveTo(projectPath);assert.equal(JSON.parse(await readFile(projectPath)).content.cards.length,0);
 record('empty unfinished project saved through real project IPC');
 for(let i=1;i<=5;i++){
  await b(page,'Karte hinzufügen').click();
  await page.getByRole('textbox',{name:'Kartenüberschrift',exact:true}).fill('Beobachtung '+i);
  await page.getByRole('textbox',{name:'Kartentext',exact:true}).fill(`1912: Karte ${i}. 1,5 °C; 2,1 mg/l; Grüße, μm und ±5 %.\n\nQuelle bleibt erhalten.`);
  if(i===1)await viewports('Karteneditor');
  if(i===5)await page.getByLabel(/^Kartengruppe/).selectOption('extension');
  if(i===1)await page.getByLabel('Bild oder Diagramm (PNG, JPEG, WebP)',{exact:true}).setInputFiles(resolve('tests/fixtures/studio/Foto-Diagramm.png'));
  await b(page,'Karte übernehmen').click();
 }
 await expect(page.locator('.studio-board [data-card]')).toHaveCount(5);
 const rect=await page.locator('[data-card="1"]').boundingBox();
 await page.mouse.move(rect.x+rect.width/2,rect.y+15);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+35,rect.y+45,{steps:6});await page.mouse.up();
 await viewports('Pinnwand');
 await app.evaluate((_,path)=>globalThis.qaSavePath=path,projectPath);await nativeKey('project-save');await expect(page.locator('.studio-unsaved')).toHaveCount(0);
 const expected=JSON.parse(await readFile(projectPath,'utf8'));
 const alternate=join(out,'Speichern unter – 5.mysteryboard');
 await app.evaluate((_,path)=>globalThis.qaSavePath=path,alternate);await nativeKey('project-save-as');await expect.poll(()=>exists(alternate)).toBeGreaterThan(10);
 assert.deepEqual(JSON.parse(await readFile(alternate)),expected);
 const firstSCORM=await scorm(join(out,'Windows-5-SCORM.zip'));
 record('five cards created, Unicode, image, V-card, movement, Ctrl-S and Ctrl-Shift-S',{projectPath,firstSCORM});
 await stop();await start();await open(projectPath,5);assert.deepEqual(await saveTo(join(out,'Wiedergeöffnet-5.mysteryboard'),true),expected);
 await expect(page.getByRole('button',{name:'Zur Projektübersicht',exact:true})).toBeVisible();
 record('full process restart and exact Mac-compatible project round trip');
 await openExports(page);await viewports('Export');await closeExports(page);
 if(mode==='full'){
  await page.locator('.studio-board [data-card="1"]').click();await b(page,'Groß ansehen').click();
  await expect(page.locator('.reading')).toContainText('1912');await screenshot('Karte-gross-lesen');await b(page,'Zur Bearbeitung').click();
  await page.getByRole('textbox',{name:'Kartenüberschrift',exact:true}).fill('Beobachtung 1 – kontrolliert');await b(page,'Karte übernehmen').click();
  await b(page,'Karte hinzufügen').click();await page.getByRole('textbox',{name:'Kartentext',exact:true}).fill('Temporäre Karte zum Löschtest.');await b(page,'Karte übernehmen').click();
  await expect(page.locator('.studio-board [data-card]')).toHaveCount(6);await page.locator('.studio-board [data-card="6"]').click();
  await page.getByText('Weitere Kartenangaben',{exact:true}).click();await b(page,'Karte löschen').click();await expect(page.locator('.studio-board [data-card]')).toHaveCount(5);
  await b(page,'Mystery gestalten').click();
  await page.getByRole('slider',{name:'Schriftgröße',exact:true}).focus();await page.keyboard.press('Home');for(let i=0;i<4;i++)await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('slider',{name:'Schriftgröße',exact:true})).toHaveValue('18');
  await page.getByLabel('Kartenfarbe',{exact:true}).evaluate(el=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'#fff4c2');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))});await b(page,'Verbindungen').click();await page.getByLabel(/^Pfeilspitze/).selectOption('open');
  await screenshot('Gestaltung');await b(page,'Darstellung').click();await b(page,'Hilfen und Nummernfarben bearbeiten').click();
  await page.getByLabel('Hilfetext',{exact:true}).fill('Vergleicht Zahlen, Quellen und begründet eure Zusammenhänge.');await b(page,'Hilfe übernehmen').click();
  if(await b(page,'Zur Pinnwand').count())await b(page,'Zur Pinnwand').click();
  const design=await saveTo(join(out,'Gestaltung-und-Hilfen.mysteryboard'),true);
  assert.equal(design.content.design.fontSize,18);assert.equal(design.content.design.cardColor,'#fff4c2');assert.equal(design.content.design.arrowHead,'open');assert(design.content.help.method.includes('Vergleicht Zahlen'));
  assert.equal(design.content.cards[0].title,'Beobachtung 1 – kontrolliert');await scorm(firstSCORM);
  record('existing card edited, large reading, deletion, font/color/arrow design and help configuration retained');
  const sources=await fixtures(out);
  const twelve=structuredClone(sources.find(x=>x.n===20).document);twelve.content.id='studio-windows-12';twelve.content.cards=twelve.content.cards.slice(0,12);twelve.content.initial.cards=twelve.content.initial.cards.slice(0,12);twelve.contentHash=createHash('sha256').update(canonical(twelve.content)).digest('hex');
  const twelvePath=join(out,'Studio-12.mysteryboard');await writeFile(twelvePath,canonical(twelve));sources.push({n:12,path:twelvePath,document:twelve});
  for(const source of sources){
   await open(source.path,source.n);const saved=join(out,`Studio-${source.n}-gespeichert.mysteryboard`);
   assert.deepEqual((await saveTo(saved,true)).content,source.document.content);
   const pdf=join(out,`Studio-${source.n}-Karten.pdf`);await app.evaluate((_,p)=>globalThis.qaSavePath=p,pdf);
   await openExports(page);await b(page,'Als Druck-PDF speichern').click();
   if(source.n!==5){await page.getByText('Druckoptionen',{exact:true}).click();
    if([16,60].includes(source.n))await page.getByRole('combobox',{name:'Papier',exact:true}).selectOption('A3');
    if([16,20].includes(source.n))await page.getByRole('checkbox',{name:'Querformat',exact:true}).check();}
   await expect(b(page,'PDF speichern')).toBeEnabled({timeout:90000});await b(page,'PDF speichern').click();await expect.poll(()=>exists(pdf),{timeout:90000}).toBeGreaterThan(1000);
   await b(page.getByRole('dialog',{name:'Als Druck-PDF speichern',exact:true}),'Schließen').click();
   await scorm(join(out,`Studio-${source.n}-SCORM.zip`));
   record(source.n+' cards, exact project content, real native PDF and SCORM');
  }
  // Text PDF: both actual pages and all twenty exact original field texts.
  await importFile('tests/fixtures/pdf-regions/Rahmen-20.pdf',20);
  await viewports('Import');
  for(const [p,n]of [[1,15],[2,5]]){
   await page.getByLabel('PDF-Seite',{exact:true}).selectOption(String(p));await expect(page.locator('[data-pdf-region]')).toHaveCount(n);
   await screenshot('PDF-Seite-'+p);
  }
  const originals=JSON.parse(await readFile('tests/fixtures/pdf-regions/ERWARTETE-KARTEN.json','utf8')).grid;
  for(let i=0;i<20;i++){await chooseImportCard(page,i);await expect(page.getByRole('textbox',{name:'Kartentext',exact:true})).toHaveValue(originals[i].text)}
  await chooseImportCard(page,0);const corrected=originals[0].text+'\n\nWindows: fachlich kontrolliert.';
  await page.getByRole('textbox',{name:'Kartentext',exact:true}).fill(corrected);
  await correction(page,'Kartengrenzen');await b(page,'Kartengrenze markieren').click();
  const height=page.getByRole('spinbutton',{name:'Höhe (%)',exact:true});await height.fill(String(Number(await height.inputValue())-.25));
  await b(page,'Grenze aktualisieren und Text neu lesen').click();await expect(page.locator('.import-step-body')).toBeEnabled({timeout:120000});
  await simpleImport(page);await chooseImportCard(page,0);await page.getByRole('textbox',{name:'Kartentext',exact:true}).fill(corrected);
  await take();await expect(page.locator('.studio-board [data-card]')).toHaveCount(20);
  const imported=await saveTo(join(out,'PDF-20-importiert.mysteryboard'));
  assert.equal(imported.content.cards[0].text,corrected);for(let i=1;i<20;i++)assert.equal(imported.content.cards[i].text,originals[i].text);
  await stop();await start();await open(join(out,'PDF-20-importiert.mysteryboard'),20);
  record('two-page text PDF, twenty exact texts, region correction, project restart');
  // DOCX: headings, paragraphs, original image bytes, table and source fields.
  await importFile('tests/fixtures/document-import/B-Word-Medien-Tabelle.docx',6);
  const wordOriginal=JSON.parse(await readFile('tests/fixtures/document-import/ORIGINAL-INHALTE.json','utf8'));
  for(let i=0;i<6;i++){await chooseImportCard(page,i);await expect(page.getByRole('textbox',{name:'Überschrift',exact:true})).toHaveValue(wordOriginal.B[i].title);
   if(i!==3)await expect(page.getByRole('textbox',{name:'Kartentext',exact:true})).toHaveValue(wordOriginal.B[i].paragraphs.join('\n\n'));}
  await take();const word=await saveTo(join(out,'Word-Medien.mysteryboard'));
  assert.deepEqual(word.content.cards[2].table,wordOriginal.table);
  for(const [i,name]of [[0,'bild-1.png'],[1,'bild-2.jpeg']])assert.deepEqual(Buffer.from(word.content.cards[i].image.split(',')[1],'base64'),await readFile('tests/fixtures/document-import/'+name));
  for(let i=0;i<6;i++){assert.equal(word.content.cards[i].source,wordOriginal.B[i].source);assert.equal(word.content.cards[i].group,wordOriginal.B[i].extension?'extension':'required')}
  record('DOCX with original image bytes, table, headings, paragraphs, sources and V-groups');
  await importFile('tests/fixtures/document-import/A-Word-12-Karten.docx',12);
  for(let i=0;i<12;i++){await chooseImportCard(page,i);await expect(page.getByRole('textbox',{name:'Kartentext',exact:true})).toHaveValue(wordOriginal.A[i].paragraphs.join('\n\n'))}
  await take();await saveTo(join(out,'Word-12-importiert.mysteryboard'));record('twelve original DOCX cards and text equality');
  // Existing shared OCR test invokes the real local worker/model and requires
  // individual review; corrected region invalidates only its affected card.
  const scanPath=join(out,'Scan-UX-korrigiert.mysteryboard');await app.evaluate((_,p)=>globalThis.qaSavePath=p,scanPath);
  const scanText=await scanWorkflow(page,out);assert.equal(JSON.parse(await readFile(scanPath)).content.cards[0].text,scanText);
  record('offline scan OCR, card text and boundary correction, individual review protection');
  // Scan PDFs: actual rasterization and local OCR on both pages.
  for(const [name,n]of [['Scan-B-16.pdf',16],['Scan-A-20.pdf',20]]){
   await b(page,'Importieren').click();await page.getByLabel('Mystery-Datei',{exact:true}).setInputFiles(resolve('tests/fixtures/ocr',name));
   const picker=page.getByLabel('Importkarte auswählen',{exact:true});
   await expect(picker.locator('option')).toHaveCount(n===20?15:16,{timeout:300000});
   if(n===20){await page.getByLabel('PDF-Seite',{exact:true}).selectOption('2');await expect(picker.locator('option')).toHaveCount(20,{timeout:300000})}
   await screenshot('OCR-'+n);await b(page,'Zur Pinnwand').click();record('offline raster PDF OCR '+n+' cards');
  }
  // Failure cases run the real IPC and atomic writes; only paths are injected.
  const protectedPath=scanPath,old=await readFile(protectedPath);
  await page.getByLabel('Mystery-Titel',{exact:true}).fill('Noch ungesichert');
  await app.evaluate(()=>globalThis.qaSavePath=null);await openExports(page);await b(page,'Speichern unter …').click();await closeExports(page);
  await expect(page.locator('.studio-unsaved')).toBeVisible();assert.deepEqual(await readFile(protectedPath),old);
  await app.evaluate((_,p)=>globalThis.qaSavePath=p,join(out,'fehlender-Ordner','nicht-schreibbar.mysteryboard'));
  await openExports(page);await b(page,'Speichern unter …').click();await expect(page.getByRole('alert').first()).toContainText('konnte nicht gespeichert werden');await screenshot('Schreibfehler');await closeExports(page);await expect(page.locator('.studio-unsaved')).toBeVisible();assert.deepEqual(await readFile(protectedPath),old);
  await app.evaluate(async({dialog,BrowserWindow})=>{globalThis.qaWarning=0;BrowserWindow.getAllWindows()[0].close()});
  await expect(page.locator('.studio-board')).toBeVisible();
  await saveTo(join(out,'Fehler-erholt.mysteryboard'),true);await expect(page.locator('.studio-unsaved')).toHaveCount(0);
  const corrupt=join(out,'Beschädigt.mysteryboard');await writeFile(corrupt,'{"format":"broken"}');
  await app.evaluate((_,p)=>globalThis.qaOpenPath=p,corrupt);await nativeKey('project-open');await expect(page.getByRole('alert')).toBeVisible();await expect(page.locator('.studio-board [data-card]')).toHaveCount(4);
  await b(page.getByRole('dialog',{name:'Aktion nicht möglich',exact:true}),'Schließen').click();
  await b(page,'Importieren').click();await page.getByLabel('Mystery-Datei',{exact:true}).setInputFiles(resolve('tests/fixtures/document-import/F-Defekt.docx'));
  await expect(page.getByRole('alert').last()).toBeVisible();
  await screenshot('Ungültiger-Import');await b(page,'Zur Pinnwand').click();
  const invalidExport=await page.evaluate(async()=>{try{await window.mysteryStudio.saveExport(new Uint8Array([1,2,3]),'../unzulässig.zip','scorm');return false}catch{return true}});assert(invalidExport);
  record('cancel save, failed real write, dirty close cancellation, corrupt project, invalid import and export rejected');
  await open(join(out,'Studio-5.mysteryboard'),5);
  await openExports(page);const popup=app.waitForEvent('window');await b(page,'Schüleransicht prüfen').click();const preview=await popup;
  await expect(preview.getByLabel('Teamname oder Vornamen',{exact:true})).toBeVisible();assert.equal(await preview.evaluate(()=>typeof window.mysteryStudio),'undefined');assert.equal(await preview.evaluate(()=>typeof require),'undefined');await preview.close();await closeExports(page);record('isolated real student preview');
  const png=join(out,'Autorenübersicht.png');await app.evaluate((_,p)=>globalThis.qaSavePath=p,png);await openExports(page);await b(page,'Als Bild exportieren').click();await expect.poll(()=>exists(png),{timeout:60000}).toBeGreaterThan(1000);await closeExports(page);record('actual native PNG overview export');
 }
 await stop();await start('-scaled',1.5);await begin();await screenshot('Skalierung-150-Prozent');record('150 percent Electron display scale starts with usable toolbar',{nativeDisplaySettingChanged:false});await stop();
 assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
 await writeFile(join(out,'Testergebnisse.json'),JSON.stringify({passed:true,mode,prefs,checks,requests,errors,dialogs,limitations:['File and confirmation dialog answers are injected; filesystem, IPC, OCR and printToPDF are real.','Synthetic Windows SendKeys events; no physical keyboard claim.','Runner permission level is not a restricted school account.','150% uses Electron device scale emulation; real Windows display settings not changed.','No actual itslearning tenant or managed school PC tested.']},null,2));
 console.log('Windows acceptance complete: '+checks.length+' checks');
}catch(error){
 console.error(error);if(page){await screenshot('FEHLER').catch(()=>{});await writeFile(join(out,'FEHLER.txt'),String(error)+'\n'+await page.locator('body').innerText().catch(()=>''))}
 await writeFile(join(out,'Testergebnisse.json'),JSON.stringify({passed:false,mode,prefs,checks,requests,errors,failure:String(error)},null,2));process.exitCode=1;
}finally{await stop().catch(()=>{})}
