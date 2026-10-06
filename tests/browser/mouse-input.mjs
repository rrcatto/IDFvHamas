import { chromium, firefox } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const browserName=process.env.BROWSER??'chromium';
const browserType=browserName==='firefox'?firefox:chromium;
const browser=await browserType.launch({headless:true,args:browserName==='chromium'?['--no-sandbox','--enable-unsafe-swiftshader']:[]});
const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(120000);
const errors=[],passed=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const report=name=>{passed.push(name);console.log('PASS',name);};
const ammo=()=>page.locator('.ammo-value').innerText().then(t=>Number.parseInt(t,10));
const waitAmmo=n=>page.waitForFunction(n=>Number.parseInt(document.querySelector('.ammo-value').textContent,10)===n,n);
const aimed=()=>page.waitForFunction(()=>getComputedStyle(document.querySelector('.aim-dot')).display!=='none');
const hip=()=>page.waitForFunction(()=>getComputedStyle(document.querySelector('.crosshair')).display!=='none');
try{
  await page.goto(process.env.GAME_URL??'http://localhost:4173');
  await page.getByRole('button',{name:'Settings',exact:false}).waitFor({timeout:60000});
  await page.getByRole('button',{name:'Settings',exact:false}).click();await page.getByLabel('Graphics quality').selectOption('Low');await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.getByRole('button',{name:'Easy',exact:true}).click();
  await page.getByRole('button',{name:'Play',exact:false}).first().click();
  await page.waitForFunction(()=>!!document.pointerLockElement&&!document.querySelector('#menus .screen')&&!document.querySelector('#menus .load-screen')&&!document.querySelector('#hud').classList.contains('hidden'));
  await page.evaluate(()=>{
    // Isolate development input checks from enemy damage while software rendering.
    // Production has no test hooks and uses ordinary Easy difficulty gameplay.
    if(window.__gameTest){const g=window.__gameTest.game;g.session.protection=999;g.enemies.enemies.forEach(e=>{e.fireCooldown=999;e.grenadeCooldown=999;});}
    window.__mouseTrace=[];
    for(const type of ['pointerdown','pointermove','pointerup','pointercancel','contextmenu','mousedown','mouseup'])document.addEventListener(type,e=>{
      if(window.__mouseTrace.length>=200)return;
      const p=window.__gameTest?.game.player;
      const record={type,button:e.button,buttons:e.buttons,pointerType:e.pointerType,target:e.target?.id,trusted:e.isTrusted,prevented:false,state:window.__gameTest?.game.session.state,adsHeld:p?.adsHeld};
      window.__mouseTrace.push(record);setTimeout(()=>{record.prevented=e.defaultPrevented;},0);
    },true);
  });
  await page.mouse.down();await page.mouse.up();await page.waitForFunction(()=>Number.parseInt(document.querySelector('.ammo-value').textContent,10)<30);report('Real left mouse fires the rifle');
  await page.keyboard.press('Digit2');await waitAmmo(15);
  await page.mouse.down({button:'right'});await aimed();await page.screenshot({path:`artifacts/${browserName}-real-ads.png`});report('Real right mouse aims the pistol');
  await page.mouse.down();await page.mouse.up();await waitAmmo(14);await aimed();report('Pistol fires while right mouse stays held for ADS');
  await page.mouse.up({button:'right'});await hip();await page.waitForTimeout(400);
  await page.mouse.down();await waitAmmo(13);await page.mouse.down({button:'right'});await aimed();assert.equal(await ammo(),13);report('Right mouse can aim while the left button is already held; pistol remains semi-automatic');
  await page.mouse.up({button:'right'});await hip();await page.mouse.up();await page.waitForTimeout(400);
  await page.mouse.down();await page.mouse.up();await waitAmmo(12);report('Releasing both buttons permits the next pistol shot');
  await page.keyboard.press('KeyR');await waitAmmo(15);report('Pistol reload still fills the magazine');
  await page.keyboard.press('Digit1');const before=await ammo();
  await page.mouse.down({button:'right'});await aimed();await page.mouse.down();await page.waitForFunction(n=>Number.parseInt(document.querySelector('.ammo-value').textContent,10)<=n-3,before);await page.mouse.up();await aimed();await page.mouse.up({button:'right'});await hip();report('Automatic rifle fire works while aiming, and releasing left mouse keeps ADS');
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Resume',exact:true}).click();await page.waitForFunction(()=>!!document.pointerLockElement);
  await page.keyboard.press('Digit2');await waitAmmo(15);await page.mouse.down({button:'right'});await aimed();await page.mouse.down();await page.mouse.up();await waitAmmo(14);await page.mouse.up({button:'right'});await hip();report('Both buttons work after pause/resume');
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Fullscreen',exact:false}).click();await page.waitForFunction(()=>!!document.fullscreenElement);await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('button',{name:'Resume',exact:true}).click();await page.waitForFunction(()=>!!document.pointerLockElement);
  await page.keyboard.press('Digit1');await page.mouse.down({button:'right'});await aimed();const fullBefore=await ammo();await page.mouse.down();await page.mouse.up();await page.waitForFunction(n=>Number.parseInt(document.querySelector('.ammo-value').textContent,10)<n,fullBefore);await page.mouse.up({button:'right'});await hip();report('Real mouse aiming and firing also work in fullscreen');
  const trace=await page.evaluate(()=>window.__mouseTrace);assert(trace.some(e=>e.type==='pointerdown'&&e.trusted));assert.equal(errors.length,0,errors.join('\n'));report('Trusted pointer events verified; no console errors');
  await writeFile(`artifacts/${browserName}-mouse-input-report.json`,JSON.stringify({passed,errors,trace},null,2));
}catch(e){console.error(e);console.error('Input trace:',await page.evaluate(()=>window.__mouseTrace).catch(()=>[]));console.error('HUD:',await page.evaluate(()=>({ammo:document.querySelector('.ammo-value')?.textContent,lock:!!document.pointerLockElement,state:window.__gameTest?.game.session.state,ads:window.__gameTest?.game.player.ads,adsHeld:window.__gameTest?.game.player.adsHeld,reload:window.__gameTest?.game.weapons.reloadTime})).catch(()=>null));console.error(errors);await page.screenshot({path:`artifacts/${browserName}-mouse-input-failure.png`}).catch(()=>{});process.exitCode=1;}finally{await browser.close();}
