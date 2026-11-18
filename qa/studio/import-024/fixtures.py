"""Author neutral fixtures and their answer sheets *before* running the importer."""
from pathlib import Path
import io,json,sys,zipfile
import fitz
from PIL import Image, ImageDraw, ImageFilter
from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.utils import ImageReader
from docx import Document
from docx.shared import Inches
from lxml import etree as ET
out=Path(sys.argv[1]);out.mkdir(exist_ok=True,parents=True)
cases={}
def note(n,count,regions=(),**extra):
    cases[n]=dict(count=count,regions=regions,**extra)
def pdf(n):
    p=Canvas(str(out/(n+'.pdf')),pagesize=(600,800), invariant=True)
    p.setFont('Helvetica',12)
    return p
def frame(p,x=45,y=150,w=500,h=540):
    p.rect(x,y,w,h)
def words(p):
    p.drawString(65,650,'Karte 1: Messstation')
    p.drawString(65,620,'Temperatur 12,5 C im Jahr 1987.')
    p.drawString(65,205,'Abb. 1: Beobachtung 3,50 mg/l')
    p.drawString(65,177,'Quelle: Feldbuch 1987')
im=Image.new('RGB',(240,160),'white');draw=ImageDraw.Draw(im)
for i,color in enumerate(['#cc5125','#128b66','#4156a0','#d4ae27']):
    draw.rectangle((i*60,12,i*60+56,144),fill=color)
draw.rectangle((0,0,239,159),outline='black',width=3)
img=ImageReader(im);im.save(out/'Messbild.png')
base=[[1,45,110,545,650]]
for n,count in [('P02',1),('P03',1),('P04',1),('P05',1),('P06',1),('P09',1)]:
    p=pdf(n);frame(p)
    if n in ('P03','P04','P05','P09'): words(p)
    if n in ('P02','P03','P04'): p.drawImage(img,82,304,180,120)
    if n=='P04':p.drawInlineImage(im,321,304,144,96)
    if n=='P05':
        p.setStrokeColor('#008899');p.line(85,300,85,500);p.line(85,300,470,300)
        path=p.beginPath();path.moveTo(90,310);path.lineTo(170,345);path.lineTo(240,360);path.curveTo(350,460,365,440,430,489);p.drawPath(path)
        p.drawString(89,510,'CO2 (ppm)');p.drawString(380,280,'2024');p.drawString(170,370,'413,2')
    if n=='P06':
        p.beginForm('tile',0,0,200,140);p.drawInlineImage(im,0,0,180,120);p.endForm()
        p.beginForm('group',0,0,225,180);p.translate(5,10);p.doForm('tile');p.endForm()
        p.saveState();p.translate(350,340);p.scale(-1,1);p.rotate(8);p.doForm('group');p.restoreState()
    if n=='P09':
        p.rect(100,300,320,150);p.line(100,370,420,370);p.line(240,300,240,450)
        p.drawString(125,400,'Jahr');p.drawString(265,400,'Niederschlag (mm)')
        p.drawString(125,330,'1990');p.drawString(265,330,'782,5')
    if n=='P06':
        p.showPage();frame(p)
        alpha=im.convert('RGBA');alpha.putalpha(Image.new('L',alpha.size,125))
        p.setFillColor('#ffeeaa');p.rect(75,290,330,180,fill=1,stroke=0)
        p.saveState();clip=p.beginPath();clip.circle(220,380,73);p.clipPath(clip,stroke=0)
        p.drawImage(ImageReader(alpha),89,294,275,169,mask='auto');p.restoreState()
        p.showPage();frame(p);p.drawString(74,590,'Karte 2: Gekacheltes Diagramm')
        p.drawImage(ImageReader(im.crop((0,0,120,160))),85,330,90,120)
        p.drawImage(ImageReader(im.crop((120,0,240,160))),175,330,90,120)
        p.drawString(75,280,'Legende: 1990 bis 2020; Einheit mm')
    p.save()
    note(n,count,base,images=2 if n=='P04' else 1,text=['12,5','1987','3,50','Feldbuch'] if n in ('P03','P04') else [],visual=n in ('P05','P06','P09'))
cases['P06'].update(count=3,images=3,regions=[[page,*base[0][1:]] for page in [1,2,3]])
# Keep the same challenging card in a realistic three-page teaching flow.
# Other frames and the unassigned photo are independently specified here.
for n in ['P04','P05']:
    first=(out/(n+'.pdf')).read_bytes()
    p=pdf(n+'-rest')
    def extra(x,y,label):
        frame(p,x,y,192,100);p.drawString(x+10,y+65,label);p.drawString(x+10,y+38,'Material '+label)
    extra(30,640,'Karte A');extra(30,480,'Karte B');extra(30,320,'Karte C')
    extra(30,160,'Karte D')
    frame(p,310,59,250,366);p.drawImage(img,318,66,234,352)
    p.drawImage(img,410,610,102,68)
    p.showPage();frame(p,45,300,420,180);p.drawString(68,405,'Ziel: Vergleicht die Messwerte.');p.save()
    with fitz.open(stream=first,filetype='pdf') as full, fitz.open(out/(n+'-rest.pdf')) as rest:
        full.insert_pdf(rest);encoded=full.tobytes()
    (out/(n+'.pdf')).write_bytes(encoded)
    cases[n]['count']=7;cases[n]['images']+=1
    cases[n]['regions']=[*base,*[[2,30,800-y-100,222,800-y] for y in [640,480,320,160]],[2,310,375,560,741],[3,45,320,465,500]]
    cases[n]['unassigned']=1
    cases[n]['visual']=False
p=pdf('P07')
for rot in [90,180,270]:
    frame(p);words(p);p.drawImage(img,90,300,150,100);p.showPage()
p.save()
with fitz.open(out/'P07.pdf') as f:
    for i,page in enumerate(f): page.set_rotation([90,180,270][i])
    data=f.tobytes()
(out/'P07.pdf').write_bytes(data)
note('P07',3,[[1,150,45,690,545],[2,55,150,555,690],[3,110,55,650,555]],images=3,review=True)
p=pdf('P08');areas=[]
for i,(x,y) in enumerate([(30,450),(30,150),(320,450),(320,150)],1):
    p.setDash([4,2] if i==2 else []);p.setLineWidth(i*.6);frame(p,x,y,250,200)
    p.drawString(x+12,y+145,'Karte '+str(i));p.drawString(x+12,y+90,'Station '+str(i)+': 8,25 m')
    areas.append([1,x,800-y-200,x+250,800-y])
p.save();note('P08',4,areas,order=['Karte '+str(i) for i in range(1,5)],images=0)
for n,source in [('P10','tests/fixtures/ocr/Scan-B-16.pdf'),('P11','tests/fixtures/ocr/Schwacher-Kontrast.png')]:
    note(n,16 if n=='P10' else 4,file=source,ocr=True)
p=pdf('P12');p.drawString(60,640,'Beobachtungen am See');p.drawString(350,400,'Messung 27. Juni');p.save();note('P12',2,review=True,manual=True)
p=pdf('P15');p.setPageSize((842,1191));frame(p,50,600,620,400);p.drawString(68,930,'Karte 1: A3');p.showPage()
p.setPageSize((842,595));frame(p,40,70,400,380);p.drawString(55,400,'Karte 2: Querformat');p.save()
with fitz.open(out/'P15.pdf') as f:
    f[1].set_cropbox(fitz.Rect(10,20,810,580));data=f.tobytes()
(out/'P15.pdf').write_bytes(data)
note('P15',2,[[1,50,191,670,591],[2,30,125,430,505]],images=0)
note('P16',None,file='tests/fixtures/document-import/F-Defekt.pdf',reject=True)
p=pdf('P17');frame(p,30,440,260,220);p.drawString(50,600,'Karte 1: Temperatur')
p.drawImage(img,360,260,180,120);p.save();note('P17',1,[[1,30,140,290,360]],images=0,unassigned=1,manual=True)
p=pdf('P18');p.drawString(100,610,'Messwerte am See');p.showPage()
frame(p);words(p);p.drawString(60,110,'Ziel: Vergleicht die Messwerte.');p.save()
note('P18',1,[[2,*base[0][1:]]],sections=['Messwerte am See','Ziel: Vergleicht die Messwerte.'])
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';C='http://schemas.openxmlformats.org/drawingml/2006/chart'; WP='http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';A='http://schemas.openxmlformats.org/drawingml/2006/main'
for n in ['P13','P14']:
    d=Document();d.add_heading('Karte 1: Messstation',1);d.add_paragraph('Messwert 12,5 mg/l');d.add_picture(str(out/'Messbild.png'),width=Inches(1.5));d.add_paragraph('Quelle: Feldbuch 1987')
    d.sections[0].header.paragraphs[0].text='Stationsnummer 31'
    if n=='P13':
        d.add_paragraph()._p.append(ET.fromstring(f'<w:r xmlns:w="{W}" xmlns:v="urn:schemas-microsoft-com:vml"><w:pict><v:shape style="width:120pt;height:60pt"><v:textbox><w:txbxContent><w:p><w:r><w:t>Beobachtung im Textfeld</w:t></w:r></w:p></w:txbxContent></v:textbox></v:shape></w:pict></w:r>'))
    else:
        table=d.add_table(rows=2,cols=2)
        for i,t in enumerate(['Jahr','mm','1990','782,5']):table.cell(i//2,i%2).text=t
        d.add_paragraph()._p.append(ET.fromstring(f'<w:r xmlns:w="{W}" xmlns:r="{R}" xmlns:wp="{WP}" xmlns:a="{A}" xmlns:c="{C}"><w:drawing><wp:inline><wp:extent cx="2400000" cy="1600000"/><wp:docPr id="20" name="Messreihe"/><a:graphic><a:graphicData uri="{C}"><c:chart r:id="rIdChart"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'))
    stream=io.BytesIO();d.save(stream);stream.seek(0)
    with zipfile.ZipFile(stream) as z: parts={name:z.read(name) for name in z.namelist()}
    if n=='P14':
        parts['word/charts/chart1.xml']=f'<c:chartSpace xmlns:c="{C}"><c:chart><c:plotArea><c:layout/><c:pieChart><c:ser><c:idx val="0"/><c:order val="0"/><c:val><c:numLit><c:ptCount val="1"/><c:pt idx="0"><c:v>782.5</c:v></c:pt></c:numLit></c:val></c:ser></c:pieChart></c:plotArea></c:chart></c:chartSpace>'.encode()
        parts['word/_rels/document.xml.rels']=parts['word/_rels/document.xml.rels'].replace(b'</Relationships>',f'<Relationship Id="rIdChart" Type="{R}/chart" Target="charts/chart1.xml"/></Relationships>'.encode())
        parts['[Content_Types].xml']=parts['[Content_Types].xml'].replace(b'</Types>',b'<Override PartName="/word/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>')
    with zipfile.ZipFile(out/(n+'.docx'),'w',zipfile.ZIP_DEFLATED) as z:
        for name,b in parts.items():z.writestr(name,b)
    note(n,1,images=1,text=['12,5','Feldbuch'],warning='Textfeld' if n=='P13' else 'Word-Diagramm',table=n=='P14')
# Actual LibreOffice PDF output for both generated Word documents.
for n in ["P13","P14"]:
    (out/(n+"-Druck.pdf")).write_bytes((Path(__file__).parent/"word-print"/(n+".pdf")).read_bytes())
(out/'soll.json').write_text(json.dumps(cases,indent=2,ensure_ascii=False)+'\n')
# Conventional protected file, existing negative fixtures and a scan with unreliable
# invisible text. All inputs are authored locally or are existing neutral fixtures.
with fitz.open(out/'P03.pdf') as doc:
    doc.save(out/'Passwort.pdf',encryption=fitz.PDF_ENCRYPT_AES_256,user_pw='Unterricht',owner_pw='Lehrkraft')
p=pdf('Scan-Textebene')
p.drawImage(ImageReader('tests/fixtures/ocr/Gerades-Foto.jpg'),0,0,600,800)
t=p.beginText(75,640);t.setTextRenderMode(3);t.textLine('OCR-Vorschlag mit fehlerhaften Messwerten und Zahlen');p.drawText(t);p.save()
(out/'sicherheit.json').write_text(json.dumps({
 'Passwort': 'Passwort.pdf', 'Beschaedigt': 'tests/fixtures/document-import/F-Defekt.docx',
 'Aktive PDF': 'tests/fixtures/document-import/F-PDF-JavaScript.pdf',
 'Aktives Word':'tests/fixtures/document-import/F-Word-aktive-Inhalte.docx',
 'Komprimiertes Word':'tests/fixtures/document-import/F-Word-komprimiert.docx',
 'Word-Mediengrenze':'tests/fixtures/document-import/F-Word-Mediengrenze.docx'
},indent=2)+'\n')
with zipfile.ZipFile(out/'Neutrale-Pruefdokumente.zip','w',zipfile.ZIP_DEFLATED) as z:
    for n,spec in cases.items():
        f=Path(spec['file']) if 'file' in spec else out/(n+('.docx' if 'warning' in spec else '.pdf'))
        z.write(f,n+f.suffix)
    for name in ['P13-Druck.pdf','P14-Druck.pdf','soll.json','sicherheit.json','Passwort.pdf','Scan-Textebene.pdf']:z.write(out/name,name)
    for f in json.loads((out/'sicherheit.json').read_text()).values():
        if f.startswith('tests/'):z.write(f,f)
