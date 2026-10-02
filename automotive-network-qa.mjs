import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {chromium} from 'playwright';
const expected=['penske','autonation','sonic','carmax','carvana','asbury','lindsay','ourisman','hertz','enterprise'];
const root=path.resolve('dist');
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.avif':'image/avif','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  const filename=path.join(root,pathname==='/'?'index.html':pathname);
  if(!filename.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  res.setHeader('Content-Type',mime[path.extname(filename)]||'application/octet-stream');
  res.end(await fs.readFile(filename));
 }catch(e){res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(8092,'127.0.0.1',resolve));
await fs.mkdir('automotive-network-checks',{recursive:true});
const browser=await chromium.launch({headless:true});const results=[];
try{
 for(const width of [390,768,1440,1920,2560]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8092/',{waitUntil:'load'});
  await page.evaluate(async()=>{document.querySelectorAll('img').forEach(i=>i.loading='eager');await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
  const data=await page.evaluate(()=>{
   const band=document.querySelector('#automotive-network');
   const logos=[...band.querySelectorAll('[data-automotive-brand]')];
   const r=band.getBoundingClientRect();
   return {width:innerWidth,bandWidth:r.width,bandHeight:r.height,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),
    previousId:band.previousElementSibling?.id,nextId:band.nextElementSibling?.id,
    brands:logos.map(li=>li.dataset.automotiveBrand),
    loadedLogos:logos.filter(li=>li.querySelector('img').naturalWidth>0).length,
    mapLoaded:band.querySelector('.an-map').naturalWidth>0,
    logoSizes:logos.map(li=>{const im=li.querySelector('img');const b=im.getBoundingClientRect();return{brand:li.dataset.automotiveBrand,width:b.width,height:b.height}}),
    noteFont:getComputedStyle(band.querySelector('.an-note')).fontSize,
    text:band.querySelector('.an-description').textContent,
    brokenImages:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.getAttribute('src')),
    automotiveCards:document.querySelectorAll('#automotive .service-card').length,
    governmentCards:document.querySelectorAll('#government .service-card').length,
    supplyCards:document.querySelectorAll('.category-card').length,
    manufacturerLogos:document.querySelectorAll('#manufacturer-network .network-logo').length,
    aboutImage:document.querySelector('#about .about-backdrop img')?.getAttribute('src')};
  });
  if(data.overflow>1||Math.abs(data.bandWidth-width)>1||data.previousId!=='automotive'||data.nextId!=='government'||data.loadedLogos!==10||!data.mapLoaded||data.brokenImages.length||errors.length||JSON.stringify(data.brands)!==JSON.stringify(expected)||data.automotiveCards!==4||data.governmentCards!==4||data.supplyCards!==6||data.manufacturerLogos!==10||!data.text.endsWith('dealership and fleet.'))throw Error(JSON.stringify({data,errors}));
  await page.locator('#automotive-network .an-cta').click();
  await page.waitForFunction(()=>document.querySelector('#inquiry-type').value==='Automotive service');
  data.automotiveContactButtonWorks=true;
  // Other original capability controls remain untouched.
  await page.locator('#dealership [data-detail]').click();
  await page.waitForSelector('#detail-dialog[open]');
  await page.locator('#detail-dialog [data-close-dialog]').click();
  data.originalCapabilityButtonWorks=true;
  if(width===1920||width===390)await page.locator('#automotive-network').screenshot({path:`automotive-network-checks/${width}.jpg`,type:'jpeg',quality:90});
  results.push(data);await page.close();
 }
 const report={passed:true,revision:'automotive-network-20261002',scope:'One new Automotive partner band only',results};
 await fs.writeFile('automotive-network-checks/qa.json',JSON.stringify(report,null,2));
 console.log('AUTOMOTIVE_NETWORK_BROWSER_QA_PASSED',JSON.stringify(report));
}finally{await browser.close();server.close();}
