#!/usr/bin/env python3
"""Local static server only. No POST/upload route, no storage, localhost binding."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import os,webbrowser
os.chdir(Path(__file__).resolve().parent)
server=ThreadingHTTPServer(('127.0.0.1',0),SimpleHTTPRequestHandler)
url=f'http://127.0.0.1:{server.server_port}/app.html'
print('MysteryBoard OCR lokal:',url,flush=True)
print('Dieses Fenster während der Nutzung offen lassen. Beenden: Strg+C.',flush=True)
webbrowser.open(url)
try:server.serve_forever()
except KeyboardInterrupt:pass
finally:server.server_close()
