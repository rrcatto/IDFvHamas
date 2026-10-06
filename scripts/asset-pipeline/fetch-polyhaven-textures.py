import json,sys,urllib.request,os,concurrent.futures as cf
ids=sys.argv[1].split(','); res=sys.argv[2] if len(sys.argv)>2 else '1k'
def get(u): return urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'idf-v-hamas-asset-fetch'}),timeout=60).read()
def one(i):
  try:
    f=json.loads(get(f'https://api.polyhaven.com/files/{i}'))
    out=f'ph/tex/{i}'; os.makedirs(out,exist_ok=True); got=[]
    for key,name in [('Diffuse','albedo'),('nor_gl','normal'),('arm','arm'),('AO','ao'),('Rough','rough')]:
      if key in f and res in f[key] and 'jpg' in f[key][res]:
        if key in ('AO','Rough') and 'arm' in f: continue
        p=f'{out}/{name}.jpg'
        if not os.path.exists(p): open(p,'wb').write(get(f[key][res]['jpg']['url']))
        got.append(name)
    return i,got
  except Exception as e: return i,'ERR '+str(e)
with cf.ThreadPoolExecutor(8) as ex:
  for r in ex.map(one,ids): print(*r)
