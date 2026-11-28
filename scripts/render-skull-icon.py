"""Render a transparent side-profile icon from the atlas's original skull meshes."""
import json, math, struct
from pathlib import Path
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parents[1]
atlas = json.loads((root / 'public/models/atlas.json').read_text())
regions = json.loads((root / 'app/viewer/regions.json').read_text())
parts = [p for p in atlas['parts'] if p['system'] == 'skeletal' and regions[p['id']] == 'head'
         and not any(w in p['name'].lower() for w in ['vertebra', 'atlas', 'axis', 'hyoid', 'disk'])]
triangles = []
for ci in set(p['chunk'] for p in parts):
    data = (root / 'public' / atlas['chunks'][ci]['url'].lstrip('/')).read_bytes()
    for p in [p for p in parts if p['chunk'] == ci]:
        vertices = list(struct.iter_unpack('<fff', data[p['positions']:p['positions']+p['vertexCount']*12]))
        indices = struct.unpack_from('<'+'I'*p['indexCount'], data, p['indices'])
        for i in range(0,len(indices),3):
            a,b,c = [vertices[j] for j in indices[i:i+3]]
            u=[b[k]-a[k] for k in range(3)];v=[c[k]-a[k] for k in range(3)]
            n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
            length=math.sqrt(sum(t*t for t in n)) or 1
            shade=.5+.5*max(0,(-n[0]*.7+n[1]*.6-n[2]*.3)/length)
            color=tuple(round(channel*shade) for channel in (229,224,202))+(255,)
            triangles.append((-(a[0]+b[0]+c[0])/3,[(q[2],-q[1]) for q in [a,b,c]],color))
points=[q for _,tri,_ in triangles for q in tri]
minx,miny=min(p[0] for p in points),min(p[1] for p in points)
maxx,maxy=max(p[0] for p in points),max(p[1] for p in points)
size=1024;scale=920/max(maxx-minx,maxy-miny)
ox=(size-(maxx-minx)*scale)/2;oy=(size-(maxy-miny)*scale)/2
im=Image.new('RGBA',(size,size));draw=ImageDraw.Draw(im)
for _,tri,color in sorted(triangles,key=lambda t:t[0]):
    draw.polygon([((x-minx)*scale+ox,(y-miny)*scale+oy) for x,y in tri],fill=color)
im.resize((256,256),Image.Resampling.LANCZOS).save(root/'public/skull-profile.png')
im.resize((64,64),Image.Resampling.LANCZOS).save(root/'public/favicon.png')
print(f'Rendered skull icon from {len(parts)} meshes, without cervical bones.')
