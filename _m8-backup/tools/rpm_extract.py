"""Read an RPM's header tags and extract its cpio payload (newc) into an empty directory."""
import bz2, gzip, io, lzma, os, struct, sys

TAGS = {1000: 'name', 1001: 'version', 1002: 'release', 1004: 'summary', 1005: 'description',
        1014: 'license', 1020: 'url', 1124: 'payloadformat', 1125: 'payloadcompressor', 1009: 'size'}

def read_header(f, pad):
    magic = f.read(8)
    assert magic[:3] == b'\x8e\xad\xe8', magic
    nindex, hsize = struct.unpack('>II', f.read(8))
    entries = [struct.unpack('>iiii', f.read(16)) for _ in range(nindex)]
    store = f.read(hsize)
    if pad:
        f.read((8 - (hsize % 8)) % 8)
    out = {}
    for tag, typ, off, count in entries:
        if tag not in TAGS:
            continue
        if typ in (6, 9):  # string / i18n string
            out[TAGS[tag]] = store[off:store.index(b'\0', off)].decode('utf-8', 'replace')
        elif typ == 4:
            out[TAGS[tag]] = struct.unpack('>i', store[off:off + 4])[0]
    return out

def main(rpm_path, dest, list_only):
    with open(rpm_path, 'rb') as f:
        f.read(96)  # lead
        read_header(f, pad=True)  # signature
        info = read_header(f, pad=False)
        for k, v in info.items():
            print(f'{k}: {v}' if k != 'description' else f'{k}: {v[:600]}')
        payload = f.read()
    comp = info.get('payloadcompressor', 'gzip')
    data = {'gzip': gzip.decompress, 'bzip2': bz2.decompress, 'xz': lzma.decompress,
            'lzma': lzma.decompress}[comp](payload)
    print('payload bytes:', len(data))
    pos, files, total = 0, 0, 0
    while True:
        hdr = data[pos:pos + 110]
        assert hdr[:6] in (b'070701', b'070702'), hdr[:6]
        fields = [int(hdr[6 + i * 8: 14 + i * 8], 16) for i in range(13)]
        mode, filesize, namesize = fields[1], fields[6], fields[11]
        name = data[pos + 110: pos + 110 + namesize - 1].decode('utf-8', 'replace')
        pos = (pos + 110 + namesize + 3) & ~3
        content = data[pos:pos + filesize]
        pos = (pos + filesize + 3) & ~3
        if name == 'TRAILER!!!':
            break
        if (mode & 0o170000) != 0o100000:  # regular files only
            continue
        rel = os.path.normpath(name.lstrip('./'))
        if rel.startswith('..') or os.path.isabs(rel):
            continue
        files += 1
        total += filesize
        if not list_only:
            out = os.path.join(dest, rel)
            os.makedirs(os.path.dirname(out), exist_ok=True)
            with open(out, 'wb') as w:
                w.write(content)
    print('files:', files, 'bytes:', total)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], len(sys.argv) > 3)
