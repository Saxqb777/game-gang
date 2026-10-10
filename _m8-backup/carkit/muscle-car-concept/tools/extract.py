import sys, os, zipfile, io
def extract(zf, dest, depth=0):
    dest = os.path.realpath(dest)
    for info in zf.infolist():
        name = info.filename
        if name.endswith('/'): continue
        if name.startswith('/') or '..' in name.replace('\\','/').split('/') or ':' in name:
            print('SKIP unsafe', name); continue
        target = os.path.realpath(os.path.join(dest, name))
        if not target.startswith(dest + os.sep):
            print('SKIP escape', name); continue
        if (info.external_attr >> 16) & 0o170000 == 0o120000:
            print('SKIP symlink', name); continue
        data = zf.read(info)
        if name.lower().endswith('.zip') and depth < 3:
            sub = target[:-4] + '_unzipped'
            os.makedirs(sub, exist_ok=False)
            extract(zipfile.ZipFile(io.BytesIO(data)), sub, depth+1)
            continue
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, 'wb') as f: f.write(data)
        print('ok', name, len(data))
zip_path, dest = sys.argv[1], sys.argv[2]
assert os.path.isdir(dest) and not os.listdir(dest), 'dest must be empty dir'
extract(zipfile.ZipFile(zip_path), dest)
