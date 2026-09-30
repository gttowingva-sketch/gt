"""Prepare only the assets requested in the 16-image revision; no page redesign."""
from pathlib import Path
from PIL import Image, ImageFilter
import cairosvg, cv2, io, numpy as np, json, urllib.request, hashlib, re
A=Path('revision-assets'); A.mkdir(exist_ok=True)
report={'baseline':'4c707c8b3f14890d20fffc29158ea362713de4c1','assets':[]}
def get(url):
 req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 MRWheels-preview'})
 with urllib.request.urlopen(req,timeout=40) as r:return r.read()
# Exact existing original source from the isolated mockup branch; never a new page mockup.
u='https://raw.githubusercontent.com/gttowingva-sketch/gt/fae7c63deec86f1cf56ed6da0f2f7a5b01f0922c/mr-wheels-exact-mockup.jpg'
scene=Image.open(io.BytesIO(get(u))).convert('RGB');w,h=scene.size
# Use ONLY the photographic right part of the first hero. No nav, UI, heading or button.
warehouse=scene.crop((round(w*.51),round(h*.04),w,round(h*.234)))
warehouse=warehouse.resize((warehouse.width*3,warehouse.height*3),Image.Resampling.LANCZOS)
warehouse=warehouse.filter(ImageFilter.UnsharpMask(radius=1.0,percent=115,threshold=3))
warehouse.save(A/'warehouse-scene.webp',quality=94,method=6)
report['assets'].append({'asset':'warehouse-scene.webp','source':u,'sourceDimensions':[w,h],'crop':[.51,.04,1,.234],'method':'crop existing photograph; UI excluded'})
# Restore the existing soldier/sunset photograph; remove the two text/graphic columns.
im=Image.open('about-soldier.avif').convert('RGB');a=np.array(im);H,W=a.shape[:2]
mask=np.zeros((H,W),np.uint8)
regions=[(int(W*.028),int(H*.16),int(W*.38),int(H*.90)),(int(W*.735),int(H*.22),int(W*.995),int(H*.89))]
for x1,y1,x2,y2 in regions:
 region=a[y1:y2,x1:x2];lo=region.min(2);hi=region.max(2)
 glyph=((lo>66)&((hi.astype(float)-lo)<65)).astype(np.uint8)*255
 glyph=cv2.dilate(glyph,np.ones((3,3),np.uint8),iterations=1)
 mask[y1:y2,x1:x2]=glyph
# The orange decorative rule is not part of the photograph.
cv2.rectangle(mask,(int(W*.75),int(H*.795)),(int(W*.81),int(H*.865)),255,-1)
bgr=cv2.cvtColor(a,cv2.COLOR_RGB2BGR);clean=cv2.inpaint(bgr,mask,4,cv2.INPAINT_TELEA)
# Recover resolution with super-resolution; document that the source was not native 4K.
method='Lanczos enhancement'
try:
 model=Path('/tmp/mrw-fsrcnn-x4.pb');model.write_bytes(get('https://raw.githubusercontent.com/Saafke/FSRCNN_Tensorflow/master/models/FSRCNN_x4.pb'))
 sr=cv2.dnn_superres.DnnSuperResImpl_create();sr.readModel(str(model));sr.setModel('fsrcnn',4)
 up=sr.upsample(clean);method='FSRCNN x4 enhancement of original source'
except Exception as e:
 up=cv2.resize(clean,None,fx=3,fy=3,interpolation=cv2.INTER_LANCZOS4);report['superresolutionFallback']=str(e)
soldier=Image.fromarray(cv2.cvtColor(up,cv2.COLOR_BGR2RGB))
soldier.save(A/'soldier-sunset-clean.webp',quality=94,method=6)
report['assets'].append({'asset':'soldier-sunset-clean.webp','source':'about-soldier.avif','sourceDimensions':[W,H],'dimensions':soldier.size,'method':method,'overlayTextRemoved':True})
# Normalize PAINTED bounds of the real vector artwork, not its arbitrary viewBox padding.
brands=['caterpillar','bosch','zf','timken','denso','cummins','lockheed-martin','boeing','rolls-royce','general-dynamics']
boxes={'caterpillar':(164,30),'bosch':(165,31),'zf':(43,43),'timken':(164,30),'denso':(164,31),'cummins':(43,43),'lockheed-martin':(172,36),'boeing':(161,36),'rolls-royce':(34,47),'general-dynamics':(176,27)}
for brand in brands:
 p=A/(brand+'.svg');raw=cairosvg.svg2png(bytestring=p.read_bytes(),output_width=1600)
 im=Image.open(io.BytesIO(raw)).convert('RGBA');v=np.array(im);rgb=v[:,:,:3].astype(float);alpha=v[:,:,3].astype(float)
 # Preserve white knockouts in black logos (in particular the Cummins wordmark).
 if brand=='rolls-royce':
  lum=.2126*rgb[:,:,0]+.7152*rgb[:,:,1]+.0722*rgb[:,:,2]
  v[:,:,:3]=np.repeat(np.clip(lum*1.4,20,207)[:,:,None],3,axis=2)
 else:
  alpha*=np.clip((251-rgb.min(2))/24,0,1);v[:,:,3]=alpha.astype('uint8');v[:,:,:3]=195
 im=Image.fromarray(v);bounds=im.getbbox()
 if not bounds:raise RuntimeError('Empty logo: '+brand)
 im=im.crop(bounds);box=tuple(x*2 for x in boxes[brand]);im.thumbnail(box,Image.Resampling.LANCZOS)
 canvas=Image.new('RGBA',(400,128));canvas.alpha_composite(im,((400-im.width)//2,(128-im.height)//2));canvas.save(A/(brand+'-optical.png'))
 report['assets'].append({'asset':brand+'-optical.png','paintedDimensions':im.size,'canvas':[400,128]})
# Keep the inspection video itself. Retrieve its uncropped original poster, if available.
try:
 t=get('https://www.dvidshub.net/video/931740').decode('utf-8','replace')
 urls=re.findall(r'https://[^\s\"\'<>]+800x450_q95\.jpg',t)
 urls+=re.findall(r'<meta[^>]+property=[\"\']og:image[\"\'][^>]+content=[\"\']([^\"\']+)',t)
 for u in dict.fromkeys(urls):
  try:
   poster=Image.open(io.BytesIO(get(u.replace('&amp;','&')))).convert('RGB')
   if poster.width<500:continue
   poster.save(A/'inspection-original.webp',quality=94,method=6);report['assets'].append({'asset':'inspection-original.webp','source':u,'dimensions':poster.size});break
  except Exception:pass
except Exception as e:report['inspectionPosterFallback']=str(e)
(A/'v8-asset-provenance.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
