import json,sys,urllib.request,os,concurrent.futures as cf
ids=sys.argv[1].split(',')
def get(u): return urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'idf-v-hamas-asset-fetch'}),timeout=120).read()
def one(i):
  try:
    f=json.loads(get(f'https://api.polyhaven.com/files/{i}'))
    g=f['gltf']['1k']['gltf']; out=f'ph/models/{i}'; os.makedirs(out,exist_ok=True)
    open(f'{out}/{i}.gltf','wb').write(get(g['url']))
    for rel,info in g.get('include',{}).items():
      p=f'{out}/{rel}'; os.makedirs(os.path.dirname(p),exist_ok=True)
      if not os.path.exists(p): open(p,'wb').write(get(info['url']))
    return i,'ok',sum(v['size'] for v in g['include'].values())
  except Exception as e: return i,'ERR',str(e)
with cf.ThreadPoolExecutor(8) as ex:
  for r in ex.map(one,ids): print(*r)
