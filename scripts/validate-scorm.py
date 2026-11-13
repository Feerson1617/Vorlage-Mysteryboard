"""Validate the delivered archive, local references and SCORM 1.2 manifest contract.

Uses an XML parser with no network access; no claim of ADL/LMS certification.
Usage: python scripts/validate-scorm.py PACKAGE.zip FINAL-RC2.html
"""
import hashlib
import json
import sys
import zipfile
from pathlib import PurePosixPath, Path
from lxml import etree

archive, html = map(Path, sys.argv[1:])
ns = {"cp": "http://www.imsproject.org/xsd/imscp_rootv1p1p2",
      "adlcp": "http://www.adlnet.org/xsd/adlcp_rootv1p2"}
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None, "ZIP CRC failure"
    names = z.namelist()
    assert len(names) == len(set(names)), "Duplicate ZIP entries"
    assert set(names) == {"imsmanifest.xml", "launch.html", "session.js", "app.html"}
    for name in names:
        p = PurePosixPath(name)
        assert not p.is_absolute() and ".." not in p.parts
    parser = etree.XMLParser(resolve_entities=False, no_network=True, load_dtd=False)
    tree = etree.fromstring(z.read("imsmanifest.xml"), parser)
    assert tree.getroottree().docinfo.doctype == "", "Unexpected DTD"
    assert tree.tag == "{" + ns["cp"] + "}manifest"
    assert tree.get("identifier") == "MysteryBoard-Boden-Klasse11-2026-11-13-RC2"
    assert tree.findtext("cp:metadata/cp:schema", namespaces=ns) == "ADL SCORM"
    assert tree.findtext("cp:metadata/cp:schemaversion", namespaces=ns) == "1.2"
    identifiers = tree.xpath("//@identifier")
    assert len(identifiers) == len(set(identifiers))
    orgs = tree.find("cp:organizations", ns)
    assert orgs.get("default") in [o.get("identifier") for o in orgs]
    resources = tree.findall("cp:resources/cp:resource", ns)
    assert len(resources) == 1
    sco = resources[0]
    assert sco.get("type") == "webcontent"
    assert sco.get("{" + ns["adlcp"] + "}scormtype") == "sco"
    assert sco.get("href") == "launch.html"
    for item in tree.findall(".//cp:item", ns):
        assert item.get("identifierref") == sco.get("identifier")
    refs = tree.xpath("//@href")
    assert all(ref in names for ref in refs)
    assert set(sco.xpath("cp:file/@href", namespaces=ns)) == set(names) - {"imsmanifest.xml"}
    assert z.read("app.html") == html.read_bytes(), "Application changed in SCORM package"
    launch = etree.HTML(z.read("launch.html"))
    assert launch.xpath("//iframe/@src") == ["app.html"]
    assert launch.xpath("//script/@src") == ["session.js"]
    assert not launch.xpath("//iframe/@sandbox"), "Wrapper must not block own downloads"
    print(json.dumps({"status": "passed", "zipCrc": "passed", "xmlWellFormed": True,
        "scorm12ManifestAndLocalReferences": "passed", "applicationByteIdentical": True,
        "htmlSha256": hashlib.sha256(html.read_bytes()).hexdigest(),
        "zipSha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        "entries": names, "note": "XML parsing and explicit SCORM 1.2 contract checks; not ADL certification or an itslearning device test."}, indent=2))
