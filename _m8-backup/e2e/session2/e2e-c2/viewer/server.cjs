const http = require('http'); const fs = require('fs'); const path = require('path');
const [,, port, carsDir] = process.argv;
const roots = { '/three/': '/home/claude/cars-wt/c2/client/node_modules/three/', '/cars/': carsDir + '/', '/': __dirname + '/' };
const types = { '.js': 'text/javascript', '.html': 'text/html', '.glb': 'model/gltf-binary', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json' };
http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  for (const [prefix, dir] of Object.entries(roots)) {
    if (!url.startsWith(prefix)) continue;
    const file = path.join(dir, url.slice(prefix.length));
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
    return fs.createReadStream(file).pipe(res);
  }
  res.writeHead(404); res.end('nf');
}).listen(Number(port));
