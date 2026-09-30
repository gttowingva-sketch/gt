import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
const root=path.resolve('dist');
const server=http.createServer(async(req,res)=>{try{const u=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const f=path.resolve(root,'.'+(u==='/'?'/index.html':u));if(!f.startsWith(root+path.sep))throw Error('path');const b=await fs.readFile(f);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.avif':'image/avif','.json':'application/json'})[path.extname(f)]||'application/octet-stream');res.end(b);}catch(e){res.statusCode=404;res.end('Not found');}});
await new Promise(r=>server.listen(8091,'127.0.0.1',r));await fs.mkdir('v8-checks',{recursive:true});
const browser=await chromium.launch({headless:true});const results=[];
try{
 const comparePage=await browser.newPage();
 await comparePage.goto('http://127.0.0.1:8091/v7-baseline.html',{waitUntil:'load'});
 const preserved=['.site-header','.hero','#automotive','#suppliers','#supply-categories','#contact','.site-footer'];
 const baseline=await comparePage.evaluate(selectors=>{
  const clean=e=>{if(!e)return null;const c=e.cloneNode(true);c.querySelectorAll('.reveal').forEach(x=>x.className=x.className.replace(/\bis-visible\b|\bvisible\b/g,'').trim());return c.outerHTML.replaceAll('viewbox=','viewBox=')};
  const text=s=>document.querySelector(s)?.textContent.replace(/\s+/g,' ').trim();return{sections:Object.fromEntries(selectors.map(s=>[s,clean(document.querySelector(s))])),about:text('#about'),process:text('.process-section'),order:[...document.querySelectorAll('main>section')].map(s=>s.id||s.className)};
 },preserved);
 await comparePage.goto('http://127.0.0.1:8091/',{waitUntil:'load'});
 const unchanged=await comparePage.evaluate(({before,selectors})=>{const clean=e=>{if(!e)return null;const c=e.cloneNode(true);c.querySelectorAll('.reveal').forEach(x=>x.className=x.className.replace(/\bis-visible\b|\bvisible\b/g,'').trim());return c.outerHTML.replaceAll('viewbox=','viewBox=')};return selectors.map(s=>({selector:s,preserved:clean(document.querySelector(s))===before.sections[s]}));},{before:baseline,selectors:preserved});
 if(unchanged.some(x=>!x.preserved))throw Error('Unrequested markup changed: '+JSON.stringify(unchanged));
 const content=await comparePage.evaluate(()=>({about:document.querySelector('#about').textContent.replace(/\s+/g,' ').trim(),process:document.querySelector('.process-section').textContent.replace(/\s+/g,' ').trim(),order:[...document.querySelectorAll('main>section')].map(s=>s.id||s.className)}));
 if(content.about!==baseline.about||content.process!==baseline.process||JSON.stringify(content.order)!==JSON.stringify(baseline.order))throw Error('Original About/Process wording or section order changed');
 await comparePage.close();
 for(const width of [390,768,1440,1920]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8091/',{waitUntil:'load'});
  await page.evaluate(async()=>{document.querySelectorAll('img').forEach(i=>i.loading='eager');await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
  const stats=await page.evaluate(()=>({width:innerWidth,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),broken:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src),logos:document.querySelectorAll('.network-logo img').length,stages:[...document.querySelectorAll('.motion-stage')].map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})),flag:document.querySelector('.mission-flag').textContent,processSoldier:!!document.querySelector('.process-section .process-art img'),aboutWarehouse:!!document.querySelector('#about .about-backdrop img'),oldAboutVisual:!!document.querySelector('#about .about-visual'),processSteps:document.querySelectorAll('.process-step').length,focusIcons:document.querySelectorAll('.focus-symbol').length,processImage:[document.querySelector('.process-art img').naturalWidth,document.querySelector('.process-art img').naturalHeight]}));
  if(stats.overflow>1||stats.broken.length||stats.logos!==10||/MISSION READY/.test(stats.flag)||!stats.processSoldier||!stats.aboutWarehouse||stats.oldAboutVisual||stats.processSteps!==5||stats.focusIcons!==6||errors.length)throw Error(JSON.stringify({stats,errors}));
  const reference=stats.stages[1];if(stats.stages.length!==4||stats.stages.some(s=>Math.abs(s.w-reference.w)>1||Math.abs(s.h-reference.h)>1))throw Error('Unequal motion canvases');
  await page.locator('[data-video="870918"]').click();await page.waitForSelector('#video-stage iframe');stats.video=await page.locator('#video-stage iframe').getAttribute('src');await page.locator('#video-dialog [data-close-dialog]').click();await page.waitForFunction(()=>!document.querySelector('#video-stage iframe'));
  await page.locator('.motion-media[data-detail="matching"]').click();await page.waitForSelector('#detail-dialog[open]');await page.locator('#detail-dialog [data-close-dialog]').click();
  if(width<760){await page.locator('.nav-toggle').click();await page.locator('.nav-toggle').click();}
  await page.evaluate(()=>{document.querySelectorAll('.reveal').forEach(e=>{e.style.opacity='1';e.style.transform='none'});});
  if(width===1920){for(const [name,sel] of [['mission','.mission'],['motion','#capabilities-motion'],['network','#manufacturer-network'],['process','.process-section'],['about','#about'],['government','#government'],['icons','.mission-separator']])await page.locator(sel).screenshot({path:`v8-checks/${name}.jpg`,type:'jpeg',quality:85,timeout:20000});}
  if(width===390)await page.screenshot({path:'v8-checks/mobile.jpg',fullPage:true,type:'jpeg',quality:72});
  results.push(stats);await page.close();
 }
 const report={revision:'refined-v8-20260930',passed:true,unchanged,aboutTextPreserved:true,processTextPreserved:true,sectionOrderPreserved:true,results};
 await fs.writeFile('v8-checks/qa.json',JSON.stringify(report,null,2));console.log('V8_BROWSER_QA_PASSED '+JSON.stringify(report));
}catch(e){await fs.writeFile('v8-checks/error.txt',e.stack||String(e));throw e;}finally{await browser.close();await new Promise(r=>server.close(r));}
