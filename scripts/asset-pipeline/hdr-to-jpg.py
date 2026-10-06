import sys, numpy as np
from PIL import Image
def read_hdr(path):
    f=open(path,'rb'); data=f.read(); i=0
    while True:
        j=data.index(b'\n',i); line=data[i:j]; i=j+1
        if line.startswith(b'-Y') or line.startswith(b'+Y'): break
    parts=line.split(); h=int(parts[1]); w=int(parts[3])
    img=np.zeros((h,w,4),np.uint8); p=i
    for y in range(h):
        if data[p]==2 and data[p+1]==2:
            p+=4
            for c in range(4):
                x=0
                while x<w:
                    n=data[p]; p+=1
                    if n>128:
                        n-=128; img[y,x:x+n,c]=data[p]; p+=1
                    else:
                        img[y,x:x+n,c]=np.frombuffer(data[p:p+n],np.uint8); p+=n
                    x+=n
        else:
            img[y]=np.frombuffer(data[p:p+w*4],np.uint8).reshape(w,4); p+=w*4
    e=img[...,3].astype(np.int32)
    scale=np.where(e>0,np.ldexp(1.0,e-136),0.0)
    return img[...,:3].astype(np.float32)*scale[...,None]
src,out,exposure=sys.argv[1],sys.argv[2],float(sys.argv[3])
hdr=read_hdr(src)*exposure
# ACES-like filmic curve then sRGB
a,b,c,d,e=2.51,0.03,2.43,0.59,0.14
x=np.clip((hdr*(a*hdr+b))/(hdr*(c*hdr+d)+e),0,1)
srgb=np.where(x<=0.0031308,12.92*x,1.055*np.power(x,1/2.4)-0.055)
im=Image.fromarray((np.clip(srgb,0,1)*255).astype(np.uint8)).resize((2048,1024),Image.LANCZOS)
im.save(out,quality=86)
print(out, hdr.shape, float(hdr.mean()), float(hdr.max()))
