import { AssetContainer, FreeCamera, Vector3, type Scene } from '../babylon';
import type { FxTextures } from '../world/environment';
import { RULES, type Settings, type Weapon } from '../config/game';
import { Navigation } from '../world/navigation';
import { WeaponView } from './weapon-view';
export class Player {
  camera: FreeCamera;
  view!: WeaponView;
  sprinting = false;
  private trauma = 0;
  private shakeTime = 0;
  keys=new Set<string>();
  fireHeld=false;
  adsHeld=false;
  ads=0;
  crouched=false;
  lean=0;
  private leanOffset=new Vector3();
  feet=0;
  vertical=0;
  grounded=true;
  moving=false;
  yaw=0;
  pitch=0;
  time=0;
  step=0;
  onFire?: ()=>void;
  onKey?: (key:string)=>void;
  onStep?: ()=>void;
  constructor(scene: Scene, private canvas: HTMLCanvasElement, public settings: Settings) {
    this.camera=new FreeCamera('player-camera',new Vector3(0,1.65,-27),scene);
    this.camera.minZ=.05; this.camera.maxZ=600; this.camera.fovMode=FreeCamera.FOVMODE_HORIZONTAL_FIXED; this.camera.inputs.clear(); this.camera.fov=settings.fov*Math.PI/180;
  }
  attachView(container: AssetContainer|undefined, fx: FxTextures) { this.view=new WeaponView(this.camera.getScene(),this.camera,container,fx); }
  /** Screen shake from nearby blasts; decays quickly. */
  shake(amount:number) { this.trauma=Math.min(1,this.trauma+amount); }
  clearInput() { this.keys.clear(); this.fireHeld=false; this.adsHeld=false; }
  toggleCrouch() { this.crouched=!this.crouched; }
  get bodyPosition() { return this.camera.position.subtract(this.leanOffset); }
  look(dx:number,dy:number) {
    this.view?.look(dx,dy);
    this.yaw+=dx*.002*this.settings.sensitivity*(this.adsHeld?.6:1);
    this.pitch=Math.max(-1.42,Math.min(1.42,this.pitch+dy*.002*this.settings.sensitivity*(this.adsHeld?.6:1)));
  }
  spawn(p:{x:number;z:number;y?:number}) { this.camera.position.set(p.x,(p.y??0)+RULES.eyeHeight,p.z); this.feet=p.y??0; this.vertical=0; this.pitch=0; this.yaw=0; this.crouched=false; this.lean=0; this.leanOffset.setAll(0); this.grounded=true; this.clearInput(); }
  forward() {
    // Input can arrive between renders. Shoot along the latest mouse aim.
    this.camera.rotation.set(this.pitch,this.yaw,-this.lean*RULES.leanRoll);
    this.camera.getViewMatrix(true);
    return this.camera.getForwardRay().direction;
  }
  update(dt:number, nav:Navigation, active:boolean, weapon:Weapon, reload:number) {
    // Movement and floor checks use the body anchor. Lean moves the head and weapon only.
    this.camera.position.subtractInPlace(this.leanOffset);
    this.time+=dt; this.ads+=(Number(this.adsHeld && active && !reload)-this.ads)*Math.min(1,dt*12);
    this.camera.fov=(this.settings.fov-this.ads*27)*Math.PI/180;
    if(active) {
      let x=Number(this.keys.has('KeyD'))-Number(this.keys.has('KeyA'));
      let z=Number(this.keys.has('KeyW'))-Number(this.keys.has('KeyS'));
      const norm=Math.hypot(x,z)||1; x/=norm; z/=norm; this.moving=!!(x||z);
      const crouch=this.crouched;
      const leanRequested=this.keys.has('KeyQ')||this.keys.has('KeyE');
      const sprint=this.keys.has('ShiftLeft')&&!this.adsHeld&&!crouch&&!leanRequested&&Math.abs(this.lean)<.1&&z>0;
      this.sprinting=sprint&&this.moving;
      const speed=crouch?RULES.crouchSpeed:sprint?RULES.sprintSpeed:RULES.walkSpeed;
      nav.move(this.camera.position,(x*Math.cos(this.yaw)+z*Math.sin(this.yaw))*dt*speed,(z*Math.cos(this.yaw)-x*Math.sin(this.yaw))*dt*speed,this.feet,RULES.playerRadius);
      const floor=nav.ground(this.camera.position.x,this.camera.position.z,this.feet);
      if(this.keys.has('Space')&&this.grounded&&!crouch) { this.vertical=RULES.jumpSpeed; this.grounded=false; }
      this.feet+=this.vertical*dt-.5*RULES.gravity*dt*dt; this.vertical-=RULES.gravity*dt;
      if(this.feet<=floor) { this.feet=floor; this.vertical=0; this.grounded=true; }
      const eye=crouch?RULES.crouchEyeHeight:RULES.eyeHeight;
      this.camera.position.y+=(this.feet+eye-this.camera.position.y)*Math.min(1,dt*20);
      if(this.moving&&this.grounded) { this.step+=dt*speed; if(this.step>2.1) { this.step=0; this.onStep?.(); } }
    } else { this.moving=false; this.sprinting=false; }
    const target=active?Number(this.keys.has('KeyE'))-Number(this.keys.has('KeyQ')):0;
    let lean=this.lean+(target-this.lean)*(1-Math.exp(-dt*RULES.leanSpeed));
    const dx=Math.cos(this.yaw)*lean*RULES.leanDistance, dz=-Math.sin(this.yaw)*lean*RULES.leanDistance;
    lean*=nav.viewOffset(this.camera.position.x,this.camera.position.y,this.camera.position.z,dx,dz,RULES.leanHeadRadius);
    this.lean=lean;
    this.leanOffset.set(Math.cos(this.yaw)*lean*RULES.leanDistance,0,-Math.sin(this.yaw)*lean*RULES.leanDistance);
    this.camera.position.addInPlace(this.leanOffset);
    this.trauma=Math.max(0,this.trauma-dt*1.6); this.shakeTime+=dt*28;
    const t2=this.trauma*this.trauma, jx=Math.sin(this.shakeTime*1.3)*t2*.05, jy=Math.sin(this.shakeTime*1.7+2)*t2*.04, jr=Math.sin(this.shakeTime*.9+4)*t2*.06;
    this.camera.rotation.set(this.pitch+jx,this.yaw+jy,-lean*RULES.leanRoll+jr);
    this.view?.update(this.time,this.moving,this.sprinting,this.ads,reload,weapon,dt);
  }
  dispose() { this.camera.dispose(); }
}
