import sys, json, struct
p = sys.argv[1]
b = open(p,'rb').read()
magic, ver, length = struct.unpack('<III', b[:12])
assert magic == 0x46546C67, 'not glb'
off = 12; chunks = []
while off < length:
    clen, ctype = struct.unpack('<II', b[off:off+8]); chunks.append((ctype, b[off+8:off+8+clen])); off += 8+clen
j = json.loads(chunks[0][1])
json.dump(j, open(sys.argv[2],'w'), indent=1)
print('version', ver, 'len', length, 'chunks', [(hex(t), len(d)) for t,d in chunks])
for k,v in j.items():
    print(k, len(v) if isinstance(v,list) else v)
