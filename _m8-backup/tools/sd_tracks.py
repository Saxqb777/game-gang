"""Draw Speed Dreams / TORCS track outlines from their XML segment lists (no XML parser: entities)."""
import glob, math, os, re, sys
from PIL import Image, ImageDraw, ImageFont

TOKEN = re.compile(r'<section\s+name="([^"]*)"\s*>|</section>|<(attnum|attstr)\s+([^>]*?)/?>', re.S)
ATTR = re.compile(r'(\w[\w ]*)="([^"]*)"')

def segments(xml):
    stack, segs, cur, seg_depth = [], [], None, None
    for m in TOKEN.finditer(xml):
        if m.group(1) is not None:
            stack.append(m.group(1))
            if seg_depth is not None and len(stack) == seg_depth:
                cur = {'name': m.group(1)}
                segs.append(cur)
            if m.group(1) == 'Track Segments' and seg_depth is None:
                seg_depth = len(stack) + 1
        elif m.group(0) == '</section>':
            if seg_depth is not None and len(stack) == seg_depth:
                cur = None
            if stack and stack[-1] == 'Track Segments':
                seg_depth = -1  # done
            stack.pop()
        elif cur is not None and len(stack) == seg_depth:
            a = dict(ATTR.findall(m.group(3)))
            name, val, unit = a.get('name'), a.get('val'), a.get('unit', '')
            if name is None or val is None:
                continue
            if m.group(2) == 'attnum':
                v = float(val)
                if unit == 'ft': v *= 0.3048
                if unit == 'rad': v = math.degrees(v)
                cur[name] = v
            else:
                cur[name] = val
    return segs

def outline(segs):
    x = y = h = 0.0
    pts = [(0.0, 0.0)]
    length = 0.0
    for s in segs:
        t = s.get('type')
        if t == 'str':
            lg = s.get('lg', 0)
            n = max(1, int(lg / 5))
            for _ in range(n):
                x += math.cos(h) * lg / n; y += math.sin(h) * lg / n; pts.append((x, y))
            length += lg
        elif t in ('lft', 'rgt'):
            arc = math.radians(s.get('arc', 0)); r0 = s.get('radius', 0); r1 = s.get('end radius', r0)
            n = max(2, int(abs(arc) / math.radians(2)))
            sign = 1 if t == 'lft' else -1
            for k in range(n):
                r = r0 + (r1 - r0) * (k + 0.5) / n
                d = arc / n
                x += math.cos(h + sign * d / 2) * r * d; y += math.sin(h + sign * d / 2) * r * d
                h += sign * d; pts.append((x, y)); length += r * d
    return pts, length, math.hypot(x, y)

def main(root, out):
    files = sorted(glob.glob(os.path.join(root, 'tracks/*/*/*.xml')))
    cells = []
    for f in files:
        cat, name = f.split('/')[-3], f.split('/')[-2]
        if os.path.basename(f) != name + '.xml':
            continue
        xml = open(f, encoding='latin1').read()
        segs = segments(xml)
        if not segs:
            continue
        pts, length, gap = outline(segs)
        cells.append((cat, name, pts, length, gap))
    cols, size = 6, 220
    rows = math.ceil(len(cells) / cols)
    img = Image.new('RGB', (cols * size, rows * (size + 30)), (16, 18, 24))
    d = ImageDraw.Draw(img)
    colour = {'circuit': (255, 138, 31), 'road': (70, 200, 255), 'dirt': (200, 160, 90), 'speedway': (170, 170, 190)}
    for i, (cat, name, pts, length, gap) in enumerate(cells):
        cx, cy = (i % cols) * size, (i // cols) * (size + 30)
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        span = max(max(xs) - min(xs), max(ys) - min(ys), 1)
        sc = (size - 30) / span
        ox = cx + 15 + ((size - 30) - (max(xs) - min(xs)) * sc) / 2
        oy = cy + 15 + ((size - 30) - (max(ys) - min(ys)) * sc) / 2
        line = [(ox + (px - min(xs)) * sc, oy + (max(ys) - py) * sc) for px, py in pts]
        d.line(line, fill=colour.get(cat, (255, 255, 255)), width=3)
        d.ellipse([line[0][0] - 4, line[0][1] - 4, line[0][0] + 4, line[0][1] + 4], fill=(255, 255, 255))
        d.text((cx + 10, cy + size + 2), f'{name} ({cat}) {length/1000:.1f} km', fill=(230, 230, 230))
        print(f'{cat:9s} {name:14s} {length:7.0f} m  closes within {gap:5.1f} m')
    img.save(out)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
