from pathlib import Path
import re, json, io, urllib.request, urllib.parse
from html import unescape
from PIL import Image
headers={'User-Agent':'Mozilla/5.0','Accept':'*/*'}
log=[]
def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=15) as r:return r.read()
candidates=[]
for url in ['https://www.dvidshub.net/video/embed/870918','https://www.dvidshub.net/video/870918','https://www.dodmantech.mil/Media/Images/igphoto/2003244421/','https://www.dodmantech.mil/']:
    try:
        text=fetch(url).decode('utf8','replace')
        log.append({'page':url,'bytes':len(text)})
        if 'dvidshub.net' in url:
            for p in re.findall(r'poster\s*[:=]\s*[\"\']([^\"\']+)',text,re.I):candidates.append((urllib.parse.urljoin(url,unescape(p)),'original-video-poster'))
            for p in re.findall(r'<meta[^>]+(?:property|name)=[\"\']og:image[\"\'][^>]+content=[\"\']([^\"\']+)',text,re.I):candidates.append((urllib.parse.urljoin(url,unescape(p)),'original-video-preview'))
        for tag in re.findall(r'<img\b[^>]*>',text,re.I):
            if 'logo' in tag.lower() and 'mantech' in tag.lower():
                m=re.search(r'src=[\"\']([^\"\']+)',tag,re.I)
                if m:candidates.append((urllib.parse.urljoin(url,unescape(m.group(1))),'official-program-logo'))
        if 'igphoto' in url:
            for p in re.findall(r'https://media\.defense\.gov/[^\"\'<>\s]+',text):
                if '230620-D-TJ319-001' in p:candidates.append((unescape(p),'official-program-logo'))
    except Exception as e:log.append({'page':url,'error':str(e)})
seen=set();chosen=None
for url,kind in candidates:
    if url in seen:continue
    seen.add(url)
    try:
        data=fetch(url);im=Image.open(io.BytesIO(data));w,h=im.size
        log.append({'image':url,'kind':kind,'width':w,'height':h})
        if min(w,h)>=256:
            im.convert('RGB').save('revision-assets/mantech-full.jpg',quality=95)
            chosen={'source':url,'kind':kind,'width':w,'height':h};break
    except Exception as e:log.append({'image':url,'error':str(e)})
Path('revision-assets/mantech-source.json').write_text(json.dumps({'chosen':chosen,'attempts':log},indent=2))
print(json.dumps({'chosen':chosen,'attempts':log},indent=2))
