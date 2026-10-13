"""Run DOM integration fixtures against a supplied headless Chromium binary."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--browser', required=True, help='Path to a Chromium headless-shell executable')
parser.add_argument('--origin', default='http://127.0.0.1:8768')
args = parser.parse_args()

class Result(HTMLParser):
    def __init__(self):
        super().__init__()
        self.inside = False
        self.text = ''
    def handle_starttag(self, tag, attrs):
        if tag == 'pre' and dict(attrs).get('id') == 'result':
            self.inside = True
    def handle_endtag(self, tag):
        if tag == 'pre':
            self.inside = False
    def handle_data(self, data):
        if self.inside:
            self.text += data

paths = ['/tests/fixture.html', '/tests/fixture.html?restore=1', '/preview/options?test=1', '/tests/stress-fixture.html', '/tests/editor-fixture.html', '/tests/editor-fixture.html?narrow=1']
paths += ['/tests/site-fixture.html?site=' + site for site in ['nodeseek.com', 'linux.do', 'chiphell.com', '52pojie.cn', 'hostloc.com']]

def run(path):
    result = subprocess.run([args.browser, '--disable-gpu', '--no-sandbox', '--dump-dom', '--virtual-time-budget=15000', args.origin + path], capture_output=True, text=True, timeout=30)
    parsed = Result()
    parsed.feed(result.stdout)
    passed = result.returncode == 0 and parsed.text.startswith('ALL PASS')
    return passed, path, parsed.text or result.stderr

with ThreadPoolExecutor(max_workers=3) as executor:
    results = list(executor.map(run, paths))
for passed, path, details in results:
    print(('PASS ' if passed else 'FAIL ') + path)
    if not passed:
        print(details)
if not all(row[0] for row in results):
    raise SystemExit(1)
print(f'All {len(results)} browser fixtures passed')
