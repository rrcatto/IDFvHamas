import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(120000);
const errors=[],passed=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const evaluate=fn=>page.evaluate(fn);
const advance=n=>page.evaluate(n=>window.__gameTest.advance(n),n);
const report=name=>{passed.push(name);console.log('PASS',name);};
const target=async()=>evaluate(()=>{
  const g=window.__gameTest.game;
  g.player.spawn({x:0,z:-27});g.session.protection=999;
  g.enemies.enemies.forEach(e=>{e.fireCooldown=999;e.grenadeCooldown=999;e.route=[];e.repath=999;});
  const e=g.enemies.enemies.find(e=>e.alive);
  e.position.set(0,0,-22);e.health=3;e.root.rotation.setAll(0);e.root.computeWorldMatrix(true);e.root.getDescendants(false).forEach(m=>m.computeWorldMatrix(true));
  g.weapons.cooldown=0;return e.id;
});
const aim=async(id,head=false)=>page.evaluate(({id,head})=>window.__gameTest.aimEnemy(id,head),{id,head});
const health=id=>page.evaluate(id=>{const e=window.__gameTest.game.enemies.enemies.find(e=>e.id===id);return {health:e.health,alive:e.alive};},id);
try{
  await page.goto('http://localhost:5173/');await page.waitForFunction(()=>!!window.__gameTest,{timeout:60000});
  await page.getByRole('button',{name:'Settings',exact:false}).click();await page.getByLabel('Graphics quality').selectOption('Low');await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.getByRole('button',{name:'Play',exact:false}).first().click();await page.waitForFunction(()=>window.__gameTest.snapshot().state==='Playing');
  let id=await target();await page.keyboard.press('Digit2');await page.mouse.down({button:'right'});await advance(.3);
  for(let n=2;n>=0;n--){await aim(id);await page.mouse.down();await page.mouse.up();assert.equal((await health(id)).health,n);await advance(.3);}
  assert(!(await health(id)).alive);assert.equal(await evaluate(()=>window.__gameTest.game.session.stats.total.pistol),1);report('Actual pistol clicks deal damage: three body hits kill');
  id=await target();await aim(id,true);await page.mouse.down();await page.mouse.up();assert(!(await health(id)).alive);assert.equal(await evaluate(()=>window.__gameTest.game.session.stats.total.headshots),1);report('Actual pistol click kills with one headshot');
  id=await target();await aim(id);await page.mouse.down();await advance(.8);assert.equal((await health(id)).health,2);await page.mouse.up();report('Holding the pistol trigger fires one shot, preserving semi-automatic operation');
  id=await target();await aim(id);
  await evaluate(()=>{for(let n=0;n<2;n++){document.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'mouse',button:0,buttons:1}));document.dispatchEvent(new PointerEvent('pointerup',{pointerType:'mouse',button:0,buttons:0}));}});
  await advance(.3);assert.equal((await health(id)).health,1);await aim(id);await advance(.3);await page.mouse.down();await page.mouse.up();assert(!(await health(id)).alive);report('A quick second pistol click is accepted during cycling');
  await evaluate(()=>{const g=window.__gameTest.game;g.player.spawn({x:0,z:-27});g.weapons.select('rifle');g.weapons.cooldown=.7;});
  await page.keyboard.press('Digit2');const loaded=await evaluate(()=>window.__gameTest.game.session.inventory.pistol.loaded);await page.mouse.down();await page.mouse.up();assert.equal(await evaluate(()=>window.__gameTest.game.session.inventory.pistol.loaded),loaded-1);report('Switching to the pistol accepts its first click immediately');
  id=await target();
  const freshAim=await page.evaluate(id=>{
    const g=window.__gameTest.game,e=g.enemies.enemies.find(e=>e.id===id);
    e.position.x=3;e.root.computeWorldMatrix(true);e.root.getDescendants(false).forEach(m=>m.computeWorldMatrix(true));
    const yaw=Math.atan2(3,5),pitch=-Math.atan2(1.12-g.player.camera.position.y,Math.hypot(3,5));
    const sensitivity=.002*g.settings.sensitivity*(g.player.adsHeld?.6:1);
    g.player.look(yaw/sensitivity,pitch/sensitivity);
    // Mouse look and the trigger can arrive between animation frames.
    document.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'mouse',button:0,buttons:1}));document.dispatchEvent(new PointerEvent('pointerup',{pointerType:'mouse',button:0,buttons:0}));
    return e.health;
  },id);assert.equal(freshAim,2);report('Pistol ray uses the latest mouse aim between rendered frames');
  id=await target();await aim(id);
  await evaluate(()=>{for(let n=0;n<2;n++){document.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'mouse',button:0,buttons:1}));document.dispatchEvent(new PointerEvent('pointerup',{pointerType:'mouse',button:0,buttons:0}));}document.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape'}));});
  await page.getByRole('button',{name:'Resume',exact:true}).waitFor();await advance(.4);await page.getByRole('button',{name:'Resume',exact:true}).click();await page.waitForFunction(()=>!!document.pointerLockElement);await advance(.4);assert.equal((await health(id)).health,2);report('Pausing cancels a buffered pistol click so resume does not fire');
  await page.mouse.up({button:'right'});
  for(const [kind,key,capacity,loaded,reserves,expected] of [['rifle','Digit1',30,20,[10,8,7,4],30],['pistol','Digit2',15,12,[8,4],15],['rifle','Digit1',30,2,[3,4,0,0],9]]){
    await page.keyboard.press(key);const total=await page.evaluate(({kind,loaded,reserves})=>{const m=window.__gameTest.game.session.inventory[kind];m.loaded=loaded;m.reserves=reserves;return m.total;},{kind,loaded,reserves});
    await page.keyboard.press('KeyR');assert(await evaluate(()=>window.__gameTest.game.weapons.reloadTime>0));await advance(2.5);
    const result=await page.evaluate(kind=>{const g=window.__gameTest.game,m=g.session.inventory[kind];g.hud.update(0,g.session,g.player,g.map,g.enemies.enemies,0,0);return {loaded:m.loaded,total:m.total,reserve:m.reserveRounds,notice:g.hud.notice};},kind);
    assert.equal(result.loaded,expected);assert.equal(result.total,total);assert.equal(result.reserve,total-expected);
    if(expected<capacity)assert.match(result.notice,/9.*gold A/i);
  }
  report('R fills rifle and pistol from partial reserves, conserves rounds, and explains an ammo shortage');
  assert.match(await page.locator('.ammo-value').innerText(),/reserve/i);
  await page.screenshot({path:'artifacts/reload-feedback.png'});
  await evaluate(()=>{const g=window.__gameTest.game;g.weapons.select('pistol');g.session.inventory.pistol.loaded=14;g.session.inventory.pistol.reserves=[1,0];});
  await page.keyboard.press('KeyR');await page.keyboard.press('Digit1');await advance(2.5);assert.equal(await evaluate(()=>window.__gameTest.game.session.inventory.pistol.loaded),14);report('Changing weapons cancels an unfinished reload without moving ammunition');
  await evaluate(()=>{const g=window.__gameTest.game;g.session.inventory.rifle.loaded=30;g.session.inventory.rifle.reserves=[0,0,0,0];});await page.keyboard.press('KeyR');assert.equal(await evaluate(()=>window.__gameTest.game.weapons.reloadTime),0);assert.match(await evaluate(()=>window.__gameTest.game.hud.notice),/full/i);
  await evaluate(()=>{window.__gameTest.game.session.inventory.rifle.loaded=0;});await page.keyboard.press('KeyR');assert.equal(await evaluate(()=>window.__gameTest.game.weapons.reloadTime),0);assert.match(await evaluate(()=>window.__gameTest.game.hud.notice),/gold A/i);report('Full magazine and exhausted ammunition give clear R feedback');
  assert.equal(errors.length,0,errors.join('\n'));report('No browser console errors');
  await writeFile('artifacts/weapon-controls-report.json',JSON.stringify({passed,errors},null,2));
}catch(e){console.error(e);console.error(errors);await page.screenshot({path:'artifacts/weapon-controls-failure.png'}).catch(()=>{});process.exitCode=1;}finally{await browser.close();}
