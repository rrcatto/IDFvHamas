import sys, numpy as np
from PIL import Image
sys.argv=[sys.argv[0]]
exec(open('hdr2jpg.py').read().split('src,out,exposure')[0])
cfg={'pizzo_pernice_puresky':dict(exp=0.9,desat=0.22,tint=(1.03,1.0,0.94),haze=(0.84,0.80,0.72),hz=0.35,out='sky_market'),
     'table_mountain_2_puresky':dict(exp=0.95,desat=0.2,tint=(1.1,0.98,0.85),haze=(0.85,0.66,0.45),hz=0.45,out='sky_residential'),
     'overcast_soil_puresky':dict(exp=0.42,desat=0.55,tint=(1.0,0.97,0.93),haze=(0.42,0.40,0.38),hz=0.5,out='sky_crossing')}
for name,c in cfg.items():
    hdr=read_hdr(f'ph/hdri/{name}.hdr')
    h,w,_=hdr.shape
    lum=hdr.mean(-1); y,x=np.unravel_index(np.argmax(lum),lum.shape)
    u=(x+0.5)/w; v=(y+0.5)/h
    lon=(u-0.5)*2*np.pi; lat=(0.5-v)*np.pi
    print(name,'sun px',x,y,'u',round(u,4),'v',round(v,4),'elev deg',round(np.degrees(lat),1),'lon deg',round(np.degrees(lon),1))
    hdr=hdr*c['exp']
    a,b,cc,d,e=2.51,0.03,2.43,0.59,0.14
    t=np.clip((hdr*(a*hdr+b))/(hdr*(cc*hdr+d)+e),0,1)
    s=np.where(t<=0.0031308,12.92*t,1.055*np.power(t,1/2.4)-0.055)
    g=s.mean(-1,keepdims=True); s=s*(1-c['desat'])+g*c['desat']; s=s*np.array(c['tint'])
    elev=np.abs(np.linspace(0.5,-0.5,h))[:,None,None]*2  # 0 at horizon, 1 at poles
    k=np.clip(1-elev/c['hz'],0,1)**1.6
    s=s*(1-k*0.6)+np.array(c['haze'])*k*0.6
    Image.fromarray((np.clip(s,0,1)*255).astype(np.uint8)).resize((2048,1024),Image.LANCZOS).save(f"env_out/{c['out']}.jpg",quality=85)
