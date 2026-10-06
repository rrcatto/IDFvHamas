import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from '/mnt/wsl/esd410c/IDFvHamas/node_modules/@playwright/test/index.mjs';
const SP=process.cwd(), NM='/mnt/wsl/esd410c/IDFvHamas/node_modules';
const types={'.js':'text/javascript','.html':'text/html','.hdr':'application/octet-stream','.map':'application/json'};
const server=http.createServer((req,res)=>{
  const u=decodeURIComponent(req.url.split('?')[0]);
  const file=u.startsWith('/nm/')?path.join(NM,u.slice(4)):path.join(SP,u);
  fs.readFile(file,(e,d)=>{ if(e){res.writeHead(404);res.end();return;} res.writeHead(200,{'content-type':types[path.extname(file)]??'application/octet-stream'}); res.end(d); });
}).listen(8765);
fs.writeFileSync(path.join(SP,'envbake.html'),`<!doctype html><canvas id=c width=64 height=64></canvas><script type=module>
import { Engine } from '/nm/@babylonjs/core/Engines/engine.js';
import { Scene } from '/nm/@babylonjs/core/scene.js';
import { HDRCubeTexture } from '/nm/@babylonjs/core/Materials/Textures/hdrCubeTexture.js';
import { EnvironmentTextureTools } from '/nm/@babylonjs/core/Misc/environmentTextureTools.js';
window.bake=async(url,size)=>{
  const engine=new Engine(document.getElementById('c'),false,{preserveDrawingBuffer:true});
  const scene=new Scene(engine);
  const tex=new HDRCubeTexture(url,scene,size,false,true,false,true);
  await new Promise((r,j)=>{ const t=setInterval(()=>{ if(tex.isReady()){clearInterval(t);r();} },100); setTimeout(()=>j('timeout'),120000); });
  const buf=await EnvironmentTextureTools.CreateEnvTextureAsync(tex,{imageType:'image/png'});
  const bytes=new Uint8Array(buf); let s=''; for(let i=0;i<bytes.length;i+=0x8000) s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  engine.dispose(); return btoa(s);
};
window.ready=true;
</script>`);
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await browser.newPage(); page.on('console',m=>console.log('console',m.text())); page.on('pageerror',e=>console.log('pageerror',e.message));
await page.goto('http://localhost:8765/envbake.html'); await page.waitForFunction(()=>window.ready);
for(const [name,out] of [['pizzo_pernice_puresky','env_market'],['table_mountain_2_puresky','env_residential'],['overcast_soil_puresky','env_crossing']]){
  const b64=await page.evaluate(([n])=>window.bake(`/ph/hdri/${n}.hdr`,256),[name]);
  fs.writeFileSync(path.join(SP,'env_out',out+'.env'),Buffer.from(b64,'base64')); console.log('wrote',out,Buffer.from(b64,'base64').length);
}
await browser.close(); server.close();
