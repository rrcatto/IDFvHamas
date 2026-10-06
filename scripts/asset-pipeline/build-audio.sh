#!/bin/bash
# Assemble game audio from CC0/CC-BY sources (see ASSET-CREDITS.md). Requires sox + ffmpeg.
set -e
OUT=../audio_out; T=$(mktemp -d); F="Prepared SFX Library"; K=x/kenney_impact-sounds/Audio; R=x/kenney_rpg-audio/Audio; I=x/kenney_interface-sounds/Audio
enc(){ ffmpeg -loglevel error -y -i "$1" -c:a libvorbis -q:a ${3:-3} "$OUT/$2.ogg"; }
# shot <src> <onset> <len> <fade> <name> <channels>
shot(){ sox "$1" -r 44100 -c ${6:-1} $T/s.wav trim $(python3 -c "print(max(0,$2-0.015))") $3 fade t 0.004 $3 $4 norm -1; enc $T/s.wav $5 4; }
shot "$F/AR-15/D_32P.wav" 0.702 1.25 0.9 rifle_fire_1 2
shot "$F/AR-15/D_32P.wav" 5.646 1.25 0.9 rifle_fire_2 2
shot "$F/Walther PPQ/X_39P.wav" 1.404 1.0 0.7 pistol_fire_1 2
shot "$F/Walther PPQ/X_39P.wav" 6.441 1.0 0.7 pistol_fire_2 2
shot "$F/Walther PPQ/X_39P.wav" 10.657 1.0 0.7 pistol_fire_3 2
i=1; for o in 0.609 3.255 6.019 9.154; do shot "$F/AK-47/C_28P.wav" $o 1.2 0.8 ak_near_$i; i=$((i+1)); done
i=1; for o in 0.352 4.416; do shot "$F/AK-47/C_31P.wav" $o 1.6 1.1 ak_far_$i; i=$((i+1)); done
i=1; for o in 0.94 5.0; do shot "$F/1911/A_42P.wav" $o 1.0 0.7 epistol_near_$i; i=$((i+1)); done
i=1; for o in 1.539 6.652; do shot "$F/1911/A_34P.wav" $o 1.4 1.0 epistol_far_$i; i=$((i+1)); done
sox ss_arreload.wav -r 44100 -c 1 $T/a.wav norm -3; enc $T/a.wav rifle_reload
sox ss_gunreload.wav -r 44100 -c 1 $T/a.wav norm -3; enc $T/a.wav pistol_reload
sox $R/metalClick.ogg -r 44100 -c 1 $T/a.wav norm -6; enc $T/a.wav dry_fire
sox $R/metalLatch.ogg -r 44100 -c 1 $T/a.wav norm -6; enc $T/a.wav weapon_switch
sox x/mb_explosions/explosions/explode.wav -r 44100 -c 1 $T/a.wav norm -1; enc $T/a.wav explosion_1 4
sox bf_deathflash.flac -r 44100 -c 1 $T/a.wav norm -1 fade 0 3.04 1.2; enc $T/a.wav explosion_2 4
sox x/mb_explosions/explosions/explodemini.wav -r 44100 -c 1 $T/a.wav norm -1; enc $T/a.wav explosion_small 4
sox ns_distant.wav -r 44100 -c 1 $T/a.wav norm -2; enc $T/a.wav explosion_distant
sox x/mb_launches/launches/rlaunch.wav -r 44100 -c 1 $T/a.wav norm -1; enc $T/a.wav rocket_launch 4
sox ad_fire.wav -r 44100 -c 1 $T/a.wav norm -3; enc $T/a.wav fire_loop
sox ad_fire.wav -r 44100 -c 1 $T/a.wav trim 0 1.4 fade q 0.6 1.4 0.5 norm -2; enc $T/a.wav barrel_ignite
i=1; for n in impactMining_000 impactMining_002 impactPlate_light_001; do sox $K/$n.ogg -r 44100 -c 1 $T/a.wav norm -4; enc $T/a.wav impact_concrete_$i; i=$((i+1)); done
i=1; for n in impactMetal_light_000 impactMetal_light_003; do sox $K/$n.ogg -r 44100 -c 1 $T/a.wav norm -4; enc $T/a.wav impact_metal_$i; i=$((i+1)); done
i=1; for n in impactWood_light_001 impactWood_light_003; do sox $K/$n.ogg -r 44100 -c 1 $T/a.wav norm -4; enc $T/a.wav impact_wood_$i; i=$((i+1)); done
i=1; for n in impactPunch_medium_000 impactPunch_medium_002 impactSoft_heavy_001; do sox $K/$n.ogg -r 44100 -c 1 $T/a.wav norm -3; enc $T/a.wav impact_flesh_$i; i=$((i+1)); done
i=1; for n in 000 001 002 003 004; do sox $K/footstep_concrete_$n.ogg -r 44100 -c 1 $T/a.wav norm -6; enc $T/a.wav step_$i; i=$((i+1)); done
i=1; for n in 0 3 6; do sox x/cb_footsteps/footsteps/boots/$n.ogg -r 44100 -c 1 $T/a.wav norm -6; enc $T/a.wav step_gravel_$i; i=$((i+1)); done
i=1; for n in pain1 pain2 pain4 pain5; do sox x/mb_human/player/$n.wav -r 44100 -c 1 $T/a.wav norm -3; enc $T/a.wav player_pain_$i; i=$((i+1)); done
sox x/mb_human/player/die1.wav -r 44100 -c 1 $T/a.wav norm -2; enc $T/a.wav player_death
i=1; for n in 03 05 09 10 14 15; do sox x/qb_slightscreams/slightscream-$n.flac -r 44100 -c 1 $T/a.wav norm -2; enc $T/a.wav enemy_pain_$i; i=$((i+1)); done
for n in "Track 2 - Hurgh" "Track 4 - Arrggh " "Track 5 - Urggh"; do sox "x/ep_pain/Painsounds v2 - $n.ogg" -r 44100 -c 1 $T/a.wav norm -2; enc $T/a.wav enemy_pain_$i; i=$((i+1)); done
i=1; for n in 0 2 3 4 6; do sox x/cb_aargh/aargh$n.ogg -r 44100 -c 1 $T/a.wav norm -2; enc $T/a.wav enemy_death_$i; i=$((i+1)); done
i=1; for n in 2yell1 2yell3 3yell3 3yell8 1yell9 1yell12; do sox "x/hd_yelling/yelling sounds/$n.wav" -r 44100 -c 1 $T/a.wav silence 1 0.01 1% reverse silence 1 0.01 1% reverse norm -3; enc $T/a.wav enemy_shout_$i; i=$((i+1)); done
sox "x/hd_yelling/yelling sounds/3grunt1.wav" -r 44100 -c 1 $T/a.wav norm -4; enc $T/a.wav enemy_throw
i=1; for n in knifeSlice knifeSlice2; do sox $R/$n.ogg -r 44100 -c 1 $T/a.wav norm -3; enc $T/a.wav knife_swing_$i; i=$((i+1)); done
sox $K/impactPunch_heavy_001.ogg -r 44100 -c 1 $T/a.wav norm -2; enc $T/a.wav knife_hit
sox $R/metalLatch.ogg $R/cloth1.ogg -r 44100 -c 1 $T/a.wav norm -5; enc $T/a.wav grenade_throw
sox $K/impactTin_medium_000.ogg -r 44100 -c 1 $T/a.wav norm -8; enc $T/a.wav grenade_bounce
sox $K/impactMetal_light_002.ogg -r 44100 -c 1 $T/a.wav vol 0.35 highpass 1500; enc $T/a.wav shell_casing
sox $R/beltHandle2.ogg $R/metalClick.ogg $R/handleSmallLeather.ogg -r 44100 -c 1 $T/a.wav norm -4; enc $T/a.wav pickup_ammo
sox $R/cloth3.ogg $R/handleSmallLeather2.ogg -r 44100 -c 1 $T/a.wav norm -4; enc $T/a.wav pickup_health
sox $I/click_002.ogg -r 44100 -c 1 $T/a.wav norm -8; enc $T/a.wav ui_click
sox $I/confirmation_001.ogg -r 44100 -c 1 $T/a.wav norm -8; enc $T/a.wav ui_confirm
sox $I/tick_001.ogg -r 44100 -c 1 $T/a.wav norm -12; enc $T/a.wav hitmarker
# synthesised (original): bomber detonator beep, bullet whiz-by
sox -n -r 44100 -c 1 $T/a.wav synth 0.09 sine 1900 fade 0.005 0.09 0.03 vol 0.6; enc $T/a.wav bomber_beep
sox -n -r 44100 -c 1 $T/a.wav synth 0.32 brownnoise bandpass 2400 1200 fade q 0.12 0.32 0.18 norm -4 speed 1.2; enc $T/a.wav bullet_whiz_1
sox -n -r 44100 -c 1 $T/a.wav synth 0.26 pinknoise bandpass 3200 1600 fade q 0.08 0.26 0.16 norm -5; enc $T/a.wav bullet_whiz_2
# ambience: wind bed (seamless crossfaded) + distant battle loop (40 s)
sox sm_wind.ogg -r 44100 -c 2 $T/w.wav norm -10
sox $T/w.wav $T/w.wav $T/w.wav $T/w.wav $T/w.wav $T/w.wav $T/w.wav $T/wind.wav
enc $T/wind.wav ambience_wind 2
sox -n -r 44100 -c 2 $T/bed.wav synth 40 brownnoise vol 0.02 lowpass 300
python3 - "$T" "$F" <<'PY'
import subprocess,random,sys
T,F=sys.argv[1],sys.argv[2]
random.seed(5); parts=[]
srcs=[(f'{F}/AK-47/C_36P.wav',0.0,4.0),(f'{F}/AK-47/C_34P.wav',0.0,4.0),(f'{F}/AK-47/C_31P.wav',0.2,2.0),(f'{F}/1911/A_34P.wav',1.4,1.4)]
cmd=['sox','-m','-v','1',f'{T}/bed.wav']
for k in range(9):
    s,o,l=random.choice(srcs); t=random.uniform(0.5,36)
    out=f'{T}/d{k}.wav'
    subprocess.run(['sox',s,'-r','44100','-c','2',out,'trim',str(o),str(l),'lowpass','900','reverb','60','vol',str(random.uniform(0.08,0.16)),'pad',str(t),'0','fade','0',str(min(40,t+l)),'0.3'],check=True)
    cmd+=['-v','1',out]
for k,t in enumerate([7.5,26.0]):
    out=f'{T}/b{k}.wav'
    subprocess.run(['sox','ns_distant.wav','-r','44100','-c','2',out,'vol','0.5','pad',str(t),'0'],check=True); cmd+=['-v','1',out]
cmd+=[f'{T}/battle.wav','trim','0','40','fade','t','1.5','40','1.5']
subprocess.run(cmd,check=True)
PY
enc $T/battle.wav ambience_battle 2
ffmpeg -loglevel error -y -i music/tactical_pursuit.mp3 -c:a libvorbis -q:a 3 $OUT/music_combat.ogg
ffmpeg -loglevel error -y -i music/perpetual_tension.mp3 -c:a libvorbis -q:a 3 $OUT/music_menu.ogg
rm -rf $T; ls $OUT | wc -l; du -sh $OUT
