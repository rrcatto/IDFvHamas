import sys,numpy as np
from PIL import Image, ImageFilter
T="dl/outfits/Modular Character Outfits - Fantasy[Standard]/Textures/Ranger"
N=1024
src=Image.open(T+'/T_Ranger_BaseColor.png').convert('RGB').resize((N,N),Image.LANCZOS)
im=np.asarray(src).astype(np.float32)/255
hsv=np.asarray(src.convert('HSV')).astype(np.float32)/255
h,s,v=hsv[...,0]*360,hsv[...,1],hsv[...,2]
def ss(a,b,x): t=np.clip((x-a)/(b-a),0,1); return t*t*(3-2*t)
cloth=ss(0.10,0.22,s)*ss(55,70,h)*(1-ss(165,180,h))
leather=ss(0.15,0.28,s)*np.maximum(1-ss(50,62,h),ss(330,345,h))
metal=(1-ss(0.12,0.2,s))*ss(0.35,0.5,v)
lum=0.2126*im[...,0]+0.7152*im[...,1]+0.0722*im[...,2]
blur=np.asarray(Image.fromarray((lum*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(24))).astype(np.float32)/255+1e-3
detail=np.clip(lum/blur,0.55,1.5)  # folds/stitching detail
rng=np.random.default_rng(7)
def noise(scale,seed):
  r=np.random.default_rng(seed).random((scale,scale)).astype(np.float32)
  return np.asarray(Image.fromarray((r*255).astype(np.uint8)).resize((N,N),Image.BICUBIC)).astype(np.float32)/255
def camo_field(seed):
  return noise(14,seed)*0.65+noise(40,seed+1)*0.35
def srgb(c): return np.array(c,np.float32)/255
def compose(cloth_rgb, gear_rgb, metal_rgb=srgb((70,70,68))):
  out=im.copy()
  shade=(detail*1.0)[...,None]
  out=out*(1-cloth[...,None])+cloth_rgb*shade*cloth[...,None]
  out=out*(1-leather[...,None])+gear_rgb*shade*leather[...,None]
  out=out*(1-metal[...,None])+metal_rgb*shade*metal[...,None]
  rest=np.clip(1-cloth-leather-metal,0,1)[...,None]
  grey=(out.mean(-1,keepdims=True))
  out=out*(1-rest*0.6)+grey*0.8*rest*0.6
  return np.clip(out,0,1)
# woodland camo
f1,f2,f3=camo_field(11),camo_field(23),camo_field(37)
base=np.empty((N,N,3),np.float32); base[:]=srgb((112,106,76))
base=np.where((f1>0.52)[...,None],srgb((58,70,44)),base)
base=np.where((f2>0.58)[...,None],srgb((92,72,50)),base)
base=np.where((f3>0.64)[...,None],srgb((30,30,27)),base)
variants={
 'camo':compose(base,srgb((34,35,30))),
 'olive':compose(srgb((84,88,58)),srgb((30,31,27))),
 'black':compose(srgb((34,34,34)),srgb((62,64,46))),
 'idf':compose(srgb((76,82,58)),srgb((44,44,38))),
 'desert':compose(np.where((f1>0.55)[...,None],srgb((140,118,84)),srgb((176,156,118))),srgb((72,62,48))),
}
for k,v_ in variants.items(): Image.fromarray((v_*255).astype(np.uint8)).save(f'char/outfit_{k}.jpg',quality=88)
# normal & ORM downsized
for name in ['Normal','ORM']:
  Image.open(f'{T}/T_Ranger_{name}.png').convert('RGB').resize((N,N),Image.LANCZOS).save(f'char/outfit_{name.lower()}.jpg',quality=90)
prev=np.concatenate([variants[k] for k in ['camo','olive','black','desert']],1)
Image.fromarray((prev*255).astype(np.uint8)).resize((2048,512)).save('outfit_variants.jpg')
