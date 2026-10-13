"""Serve real UI with test-only Chrome stubs; never use mocks in the package."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
from urllib.parse import urlsplit, parse_qs

root = Path(__file__).resolve().parents[1]
os.chdir(root)

class Preview(SimpleHTTPRequestHandler):
    def do_GET(self):
        page = self.path.split('?', 1)[0]
        if page in ('/preview/options', '/preview/popup'):
            name = page.rsplit('/', 1)[-1]
            html = (root / 'extension' / f'{name}.html').read_text()
            html = html.replace('<head>', '<head><base href="/extension/">')
            html = html.replace('<script src="client.js">', '<script src="/extension/repository.js"></script><script src="/tests/mock-chrome.js"></script><script src="client.js">')
            if name == 'options' and parse_qs(urlsplit(self.path).query).get('test') == ['1']:
                html = html.replace('</body>', '<script src="/tests/options-fixture.js"></script></body>')
            elif name == 'options' and parse_qs(urlsplit(self.path).query).get('demo') == ['1']:
                html = html.replace('</body>', '<script src="/tests/settings-preview.js"></script></body>')
            content = html.encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        else:
            super().do_GET()

print('Preview: http://127.0.0.1:8768/preview/options', flush=True)
ThreadingHTTPServer(('127.0.0.1', 8768), Preview).serve_forever()
