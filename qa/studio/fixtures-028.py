from pathlib import Path
from docx import Document
import sys
out=Path(sys.argv[1])
doc=Document()
for i,(title,text) in enumerate([("Der Schulhof","Nach einem Schauer bilden sich auf dem Asphalt Pfützen."),("Die Wiese","Auf der Wiese verschwindet das Wasser zwischen den Halmen.")],1):
    doc.add_heading(f"Karte {i}: {title}",level=1)
    doc.add_paragraph(text)
doc.save(out/"Wasser.docx")
