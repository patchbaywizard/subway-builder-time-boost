"""Build the distributable mod ZIP and its checksum using Python's standard library."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
source = root / 'time-boost'
manifest = json.loads((source / 'manifest.json').read_text())
assert (source / manifest['main']).is_file(), 'Manifest entry point is missing'
output = root / 'dist'
output.mkdir(exist_ok=True)
archive = output / f"time-boost-{manifest['version']}.zip"
files = sorted(p for p in source.rglob('*') if p.is_file() and p.name != '.DS_Store')
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for path in files:
        bundle.write(path, path.relative_to(root))
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    for path in files:
        assert bundle.read(str(path.relative_to(root))) == path.read_bytes()
(output / 'manifest.json').write_bytes((source / 'manifest.json').read_bytes())
checksum = archive.with_suffix('.zip.sha256')
checksum.write_text(f'{hashlib.sha256(archive.read_bytes()).hexdigest()}  {archive.name}\n')
print(f'Built and verified {archive.name} ({len(files)} files)')
print(f'Checksum: {checksum.name}')
