import {useState} from "react";
import {Dialog} from "../../src/components/Dialog";
import {importLevels,type ImportedProject} from "../exchange/import";
export function ExchangeReview({project,replacing,onClose,onApply}:{project:ImportedProject;replacing:boolean;onClose:()=>void;onApply:()=>Promise<void>}) {
 const [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,fail]=useState("");
 const levels=importLevels(project);
 const extended=levels.some(l=>l.draft.content.recovery==="extended") || (project.format==="MysteryBoardCollection"&&project.defaultRecovery==="extended");
 return <Dialog title="KI-Material prüfen" onClose={()=>{if(!busy)onClose();}}>
 <h3>{project.format==="MysteryBoardCollection"?project.title:project.content.title}</h3>
 <p>Bitte überprüfe die fachlichen Aussagen und Quellen vor dem Unterricht.</p>
 <ul className="exchange-levels">{levels.map(({name,draft},i)=>{
 const c=draft.content;
 const media=c.cards.reduce((n,k)=>n+Number(!!k.image)+(k.extraImages?.length??0),0);
 return <li key={i}><strong>{name}</strong> · {c.cards.length} Karten · {media} Bilder · {c.cards.filter(k=>!!k.table).length} Tabellen
 <br/>{c.help?.method?"Eigener Denkimpuls":"Allgemeiner Denkimpuls"} · {c.help?.categories?.length??0} Hilfekategorien · {c.cards.filter(k=>k.studentEditable).length} bearbeitbare Karten
 <br/>{c.initial.edges.length} veröffentlichte Starthilfen · {draft.author.edges?.length??0} private Verbindungen · {draft.author.hiddenCards.length} ausgeblendete Karten
 <br/>Speicherung: {c.recovery==="extended"?"Erweitert lokal":c.recovery==="off"?"Ausgeschaltet":"Während der Sitzung"}</li>;
 })}</ul>
 {extended && <label className="author-publication-confirmation"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Erweiterte lokale Speicherung für die angegebenen Niveaus zulassen (bis zu drei Stunden auf diesem Gerät).</label>}
 {replacing && <p>Mit der Übernahme ersetzt du das geöffnete Projekt.</p>}
 {error && <p role="alert">{error}</p>}
 <div className="actions"><button disabled={busy} onClick={onClose}>Abbrechen</button><button className="primary" disabled={busy || (extended&&!consent)} onClick={async()=>{setBusy(true);try{await onApply();}catch(e){fail((e as Error).message);setBusy(false);}}}>Als Projekt übernehmen</button></div>
 </Dialog>;
}
