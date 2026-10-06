import { DEFAULT_SETTINGS, MAP_NAMES, type Difficulty, type Settings } from '../config/game';
import { MAPS } from '../config/maps';
import { Session } from '../logic/session';
import { accuracy, type Stats } from '../logic/statistics';
export type MenuAction='play'|'resume'|'restart'|'quit'|'next'|'fullscreen'|'settings-changed';
export class Menus {
  element=document.querySelector<HTMLElement>('#menus')!;
  difficulty:Difficulty='Normal';
  onAction?:(action:MenuAction)=>void;
  private returnPage:'main'|'pause'='main';
  constructor(public settings:Settings) {
    this.element.addEventListener('click',e=>{
      const button=(e.target as HTMLElement).closest<HTMLButtonElement>('button'); if(!button) return;
      const diff=button.dataset.difficulty; if(diff) { this.difficulty=diff as Difficulty; this.main(); return; }
      const action=button.dataset.action;
      if(action==='help') this.help(); else if(action==='credits') this.credits();
      else if(action==='settings') this.settingsPage(); else if(action==='back') this.returnPage==='pause'?this.pause():this.main();
      else if(action) this.onAction?.(action as MenuAction);
    });
    this.element.addEventListener('input',e=>{
      const input=e.target as HTMLInputElement; const key=input.dataset.setting as keyof Settings;
      if(!key) return;
      if(key==='quality') this.settings.quality=input.value as Settings['quality'];
      else this.settings[key]=Number(input.value);
      const output=this.element.querySelector(`[data-value="${key}"]`); if(output) output.textContent=input.value;
      this.onAction?.('settings-changed');
    });
  }
  button(text:string,action:string,primary=false,hint='') { return `<button class="button ${primary?'primary':''}" data-action="${action}">${text}${hint?`<small>${hint}</small>`:''}</button>`; }
  hide() { this.element.innerHTML=''; }
  loading(name:string,detail='Building the battlefield…') {
    const brief=MAPS.find(m=>m.name===name)?.brief??'';
    this.element.innerHTML=`<div class="load-screen"><div><p>PREPARING OPERATION</p><h1>${name}</h1><p>${brief||detail}</p><div class="load-bar"><i></i></div><p class="load-detail">${detail}</p></div></div>`;
  }
  progress(fraction:number) { const bar=this.element.querySelector<HTMLElement>('.load-bar i'); if(bar) bar.style.width=`${Math.round(Math.min(1,fraction)*100)}%`; }
  main() {
    this.returnPage='main';
    this.element.innerHTML=`<section class="screen"><div class="brandline"><div class="emblem">⌖</div> FIELD OPERATIONS <span>/</span> SINGLE PLAYER</div><div class="menu-content"><p class="eyebrow">Three districts. Fifteen minutes.</p><h1 class="title">IDF <i class="versus">v</i><span>Hamas</span></h1><p class="subtitle">Kill the waves of terrorists, save Israel!</p><div class="difficulty">${(['Easy','Normal','Hard'] as Difficulty[]).map(d=>`<button class="${d===this.difficulty?'selected':''}" data-difficulty="${d}">${d}</button>`).join('')}</div><div class="menu-buttons">${this.button('Play','play',true,'01 →')}${this.button('How to Play','help',false,'CONTROLS')}${this.button('Settings','settings',false,'OPTIONS')}${this.button('Fullscreen','fullscreen',false,'⤢')}${this.button('Credits','credits')}</div></div><aside class="mission-card"><p class="eyebrow">Three operations</p>${MAPS.map((m,i)=>`<div class="mission"><b>0${i+1}</b><div><h3>${m.name}</h3><p>${m.brief}</p></div></div>`).join('')}</aside><footer class="menu-foot">FICTIONAL COMBAT · NO CIVILIANS<br>DESKTOP · KEYBOARD & MOUSE</footer></section>`;
  }
  panel(title:string,body:string,actions=this.button('Back','back')) {
    this.element.innerHTML=`<section class="screen"><div class="panel"><p class="eyebrow">Field operations / IDF v Hamas</p><h1>${title}</h1>${body}${actions}</div></section>`;
  }
  help() {
    const controls=[['W A S D','Move'],['MOUSE','Look'],['SHIFT','Sprint'],['CTRL','Toggle crouch'],['HOLD Q / E','Lean left / right'],['SPACE','Jump'],['LEFT MOUSE','Fire / throw / knife'],['RIGHT MOUSE','Aim down sights'],['R','Fill magazine'],['1 / 2 / 3','Rifle / pistol / knife'],['4 / 5','Frag / smoke grenade'],['F','Use supply'],['ESC','Pause']];
    this.panel('How to Play',`<div class="controls">${controls.map(([key,label])=>`<div class="control"><span>${label}</span><span class="key">${key}</span></div>`).join('')}</div><p>Survive three five-minute waves on three different maps. Each kill earns 100 points; a headshot earns 150 total. Three body hits or one close knife strike kill an enemy.</p><p>Press Ctrl once to crouch and again to stand. Hold Q or E to peek around cover; release to centre your view. Leaning is limited by nearby walls. Press F at a supply box. Gold A markers on the minimap show available ammo; white crosses show health. Markers disappear when used.</p><p>The pistol fires once per click. Either firearm kills with three body hits or one headshot. R fills the magazine using remaining ammo, including partial reserves. If you have too few rounds left, it loads what remains; refill at a gold A marker.</p><p>Death starts a 15-second respawn countdown; the wave clock keeps running. Respawn with a full loadout and five seconds of protection. Each map has five single-use health packs and two single-use ammo boxes. Smoke conceals you from enemy targeting. Shoot fuel barrels to trigger a delayed explosion.</p><p>Click Play or Resume to capture the mouse. Esc releases it and pauses. Choose Fullscreen from the menu or Settings.</p>`);
  }
  settingsPage() {
    const rows:[keyof Settings,string,number,number,number][]=[['master','Master volume',0,1,.05],['effects','Effects volume',0,1,.05],['music','Music volume',0,1,.05],['sensitivity','Mouse sensitivity',.2,3,.1],['fov','Field of view',60,110,1]];
    this.panel('Settings',`${rows.map(([key,label,min,max,step])=>`<label class="settings-row"><span>${label}</span><input aria-label="${label}" type="range" min="${min}" max="${max}" step="${step}" value="${this.settings[key]}" data-setting="${key}"><output data-value="${key}">${this.settings[key]}</output></label>`).join('')}<label class="settings-row"><span>Graphics quality</span><select aria-label="Graphics quality" data-setting="quality">${['Low','Medium','High'].map(q=>`<option ${q===this.settings.quality?'selected':''}>${q}</option>`).join('')}</select></label><p>Low reduces resolution and disables shadows, surface detail maps and post-processing; High adds film grain and full-resolution shadows. Settings apply immediately and reset when the page reloads.</p>`,this.button('Fullscreen','fullscreen')+this.button('Back','back'));
  }
  credits() {
    const by=(work:string,author:string,licence:string)=>`<li><b>${work}</b> — ${author} — ${licence}</li>`;
    this.panel('Credits',`<p>Game design, code, maps and procedural geometry © 2026 Richard Catto, released under the MIT Licence.</p>
<h3>Attribution (CC BY)</h3><ul class="credits">
${by('“Tactical Pursuit” (combat music)','Matthew Pablo, opengameart.org','CC BY 3.0')}
${by('“Perpetual Tension” (menu music)','Zander Noriega, opengameart.org','CC BY 3.0')}
${by('Explosions, rocket launch, player pain sounds','Michel Baradari (apollo-music.de), opengameart.org','CC BY 3.0')}
${by('“Big Explosion” (DeathFlash)','Blender Foundation (Yo Frankie!), opengameart.org','CC BY 3.0')}
${by('Footsteps on different surfaces; “Aargh!” male screams','congusbongus, opengameart.org','CC BY 3.0')}
${by('RPG Launcher model','austincford, poly.pizza','CC BY 3.0')}
</ul><h3>Public domain (CC0) assets</h3><ul class="credits">
<li>Characters, outfits, animations, weapons and car models — Quaternius</li>
<li>PBR textures, HDRI skies and props — Poly Haven</li>
<li>Particles, impact, interface and RPG sounds — Kenney</li>
<li>Firearm recordings — The Free Firearm Sound Library (Ben Jaszczak et al.)</li>
<li>Vocal effects — qubodup, EmoPreben, HaelDB · Reloads — SpringySpringo · Fire — AntumDeluge · Wind — SketchMan3 · Distant explosion — NenadSimic · Grenade model — CreativeTrio</li>
</ul><p>Babylon.js 9.28 and loaders — Babylon.js contributors — Apache 2.0. Havok Physics for Babylon.js — MIT. Full list: ASSET-CREDITS.md and <a href="${import.meta.env.BASE_URL}THIRD-PARTY-LICENSES.txt" target="_blank" rel="noopener" style="color:#c5d19e">bundled software licences</a>.</p>
<p>This is fictional entertainment. Every human NPC is an armed enemy combatant. No real locations or individuals are reproduced.</p>`);
  }
  pause() { this.returnPage='pause'; this.panel('Operation Paused','<p>The wave clock, combat and physics are paused.</p>',`<div class="menu-buttons">${this.button('Resume','resume',true)}${this.button('Restart Game','restart')}${this.button('Settings','settings')}${this.button('Quit to Main Menu','quit')}</div>`); }
  stats(s:Stats) {
    const fields:[string,string|number][]=[['Deaths',s.deaths],['Accuracy',`${accuracy(s).toFixed(1)}%`],['Headshots',s.headshots],['Shots fired',s.shotsFired],['Shots hit',s.shotsHit],['Rifle kills',s.rifle],['Pistol kills',s.pistol],['Knife kills',s.knife],['Frag kills',s.frag],['Environmental kills',s.environment],['Bombers stopped',s.bombers],['Explosion deaths',s.explosionDeaths],['Current streak',s.streak],['Best streak',s.bestStreak]];
    return `<div class="stats-hero"><div><strong>${s.score.toLocaleString()}</strong><small>Score</small></div><div><strong>${s.kills}</strong><small>Enemies killed</small></div></div><div class="stats-grid">${fields.map(([label,n])=>`<div class="stat">${label}<b>${n}</b></div>`).join('')}</div>`;
  }
  results(session:Session) {
    const final=session.state==='GameComplete';
    this.panel(final?'Operation Complete':`Wave ${session.wave+1} Complete`,
      `<p>${MAP_NAMES[session.wave]} · 05:00 elapsed · ${session.difficulty}</p>${this.stats(final?session.stats.total:session.stats.waves[session.wave])}`+
      (final?`<table class="wave-table"><thead><tr><th>Map</th><th>Kills</th><th>Deaths</th><th>Score</th><th>Accuracy</th></tr></thead><tbody>${session.stats.waves.map((s,i)=>`<tr><td>${i+1} / ${MAP_NAMES[i]}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.score}</td><td>${accuracy(s).toFixed(1)}%</td></tr>`).join('')}</tbody></table>`:`<p>Next: Wave ${session.wave+2} — ${MAP_NAMES[session.wave+1]}. Review your results, then continue when ready.</p>`),
      `<div class="panel-actions">${this.button(final?'Play Again':`Begin Wave ${session.wave+2}`,final?'restart':'next',true,final?'':'ENTER')}${this.button('Main Menu','quit')}</div>`);
  }
}
