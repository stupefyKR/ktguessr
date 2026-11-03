import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const testRoot = fileURLToPath(new URL('./', import.meta.url));
const mime = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml' };
const server = http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url,'http://localhost');
    let file;
    if (url.pathname === '/__qa__/') {
      const html = (await readFile(path.join(root,'index.html'),'utf8')).replace('<head>','<head><base href="/"><script src="/__qa__/google-double.js"></script>');
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);return;
    }
    if (url.pathname === '/__qa__/google-double.js') file = path.join(testRoot,'google-double.js');
    else {
      const requested = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
      file = path.resolve(root,requested);
      if (!file.startsWith(path.resolve(root) + path.sep)) { res.writeHead(403);res.end();return; }
    }
    const data = await readFile(file);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  } catch {res.writeHead(404);res.end('Not found');}
});
const port = Number(process.env.PORT || 4173);
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}/`));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
