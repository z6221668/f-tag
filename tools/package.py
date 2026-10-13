"""Create a store upload archive using only runtime files (no dependencies)."""
from pathlib import Path
import json
import zipfile

root = Path(__file__).resolve().parents[1]
extension = root / "extension"
manifest = json.loads((extension / "manifest.json").read_text())
output = root / "dist" / f"f-tag-{manifest['version']}.zip"
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(extension.rglob("*")):
        if path.is_file() and not path.name.startswith("."):
            info = zipfile.ZipInfo(str(path.relative_to(extension)), date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes())
print(output)
