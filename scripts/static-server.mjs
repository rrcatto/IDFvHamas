// Read-only local static server for testing dist/ below an arbitrary website path.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root=resolve('dist'),port=Number(process.env.PORT??4180),prefix='/nested/game/';
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.wasm':'application/wasm','.wav':'audio/wav','.ogg':'audio/ogg','.jpg':'image/jpeg','.png':'image/png','.glb':'model/gltf-binary','.svg':'image/svg+xml','.txt':'text/plain'};
http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(!url.pathname.startsWith(prefix)){res.writeHead(404);res.end();return;}
  const relative=decodeURIComponent(url.pathname.slice(prefix.length))||'index.html';
  const path=resolve(root,relative);
  if(!path.startsWith(root+'/')){res.writeHead(403);res.end();return;}
  try{const data=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]??'application/octet-stream','Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(404);res.end();}
}).listen(port,'127.0.0.1',()=>console.log(`Static build: http://localhost:${port}${prefix}`));
