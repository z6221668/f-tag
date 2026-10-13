"""Resize the provided artwork. Uses Pillow, or macOS sips as a fallback.
Pre-generated icons are shipped; packaging does not need either tool.
"""
from pathlib import Path
import shutil
import subprocess
import tempfile
root = Path(__file__).resolve().parents[1]
source = root / 'assets' / 'icon-original.png'
output = root / 'extension' / 'icons'
sizes = (16, 32, 48, 128)
output.mkdir(exist_ok=True)
try:
    from PIL import Image
except ImportError:
    if not shutil.which('sips'):
        raise SystemExit('Install Pillow to regenerate icons: python3 -m pip install Pillow')
    info = subprocess.check_output(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', str(source)], text=True)
    side = max(int(line.split(':',1)[1]) for line in info.splitlines() if 'pixelWidth:' in line or 'pixelHeight:' in line)
    with tempfile.TemporaryDirectory() as directory:
        square = Path(directory) / 'square.png'
        subprocess.run(['sips','--padToHeightWidth',str(side),str(side),'--padColor','FFFFFF',str(source),'--out',str(square)],check=True,capture_output=True)
        for size in sizes:
            subprocess.run(['sips','--resampleHeightWidth',str(size),str(size),str(square),'--out',str(output / f'{size}.png')],check=True,capture_output=True)
else:
    with Image.open(source) as original:
        image = original.convert('RGBA')
        side = max(image.size)
        canvas = Image.new('RGBA',(side,side),'white')
        canvas.alpha_composite(image,((side-image.width)//2,(side-image.height)//2))
        for size in sizes:
            canvas.resize((size,size),Image.Resampling.LANCZOS).save(output / f'{size}.png')
print('Generated icons:', ', '.join(str(size) for size in sizes))
