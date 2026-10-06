import './ui/styles.css';
import { Game } from './game';
const canvas=document.querySelector<HTMLCanvasElement>('#game')!;
const game=new Game(canvas);
game.init().catch(error=>{
  console.error(error);
  document.querySelector('#menus')!.innerHTML='<div class="load-screen"><div><h1>Unable to start</h1><p>This game needs a desktop browser with WebGL 2 enabled.<br>Reload after enabling hardware acceleration.</p></div></div>';
});
