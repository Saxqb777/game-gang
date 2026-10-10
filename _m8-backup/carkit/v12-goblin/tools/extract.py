import sys, zipfile, os, io
def safe_extract(zf, dest, depth=0):
    dest = os.path.realpath(dest)
    os.makedirs(dest, exist_ok=True)
    for info in zf.infolist():
        name = info.filename
        if name.endswith('/'): continue
        if os.path.isabs(name) or '..' in name.replace('\\','/').split('/'):
            print('SKIP unsafe', name); continue
        target = os.path.realpath(os.path.join(dest, name))
        if not target.startswith(dest + os.sep):
            print('SKIP escape', name); continue
        if (info.external_attr >> 16) & 0o170000 == 0o120000:
            print('SKIP symlink', name); continue
        os.makedirs(os.path.dirname(target), exist_ok=True)
        data = zf.read(info)
        if name.lower().endswith('.zip') and depth < 3:
            sub = target[:-4]
            os.makedirs(sub, exist_ok=False)
            safe_extract(zipfile.ZipFile(io.BytesIO(data)), sub, depth+1)
        else:
            with open(target, 'wb') as f: f.write(data)
            print('OK', name, len(data))
src, dest = sys.argv[1], sys.argv[2]
if os.path.exists(dest) and os.listdir(dest): sys.exit('dest not empty')
safe_extract(zipfile.ZipFile(src), dest)
