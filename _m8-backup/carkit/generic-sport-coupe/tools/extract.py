import zipfile, os, sys, io
def safe_extract(zf, dest):
    dest = os.path.realpath(dest)
    for info in zf.infolist():
        name = info.filename
        if name.endswith('/'): continue
        if name.startswith('/') or '..' in name.replace('\\','/').split('/'):
            print('SKIP unsafe', name); continue
        target = os.path.realpath(os.path.join(dest, name))
        if not target.startswith(dest + os.sep):
            print('SKIP outside', name); continue
        # symlink check
        if (info.external_attr >> 16) & 0o170000 == 0o120000:
            print('SKIP symlink', name); continue
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with zf.open(info) as src, open(target, 'wb') as out:
            out.write(src.read())
        if name.lower().endswith('.zip'):
            sub = target[:-4] + '_unzipped'
            os.makedirs(sub, exist_ok=False)
            with zipfile.ZipFile(target) as z2: safe_extract(z2, sub)
zip_path, dest = sys.argv[1], sys.argv[2]
os.makedirs(dest, exist_ok=False)
with zipfile.ZipFile(zip_path) as z: safe_extract(z, dest)
print('done')
