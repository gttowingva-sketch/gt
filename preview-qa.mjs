import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
const root=path.resolve('dist');
const types={'.html':'text/html','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.avif':'image/avif','.json':'application/json'};
const server=http.createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep))throw Error('path');const data=await fs.readFile(file);res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data);}catch(_){res.statusCode=404;res.end('Not found');}});
await new Promise(r=>server.listen(4173,'127.0.0.1',r));
await fs.mkdir('preview-checks',{recursive:true});
const browser=await chromium.launch({headless:true});
const report={build:'fullwidth-v7-20260930',widths:[],liveSiteModified:false};
try{
 for(const width of [390,768,1440,1920]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**://www.dvidshub.net/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Video frame structural test</title>'}));
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
  await page.evaluate(async()=>{document.querySelectorAll('img').forEach(i=>i.loading='eager');await Promise.all([...document.images].map(i=>i.decode().catch(()=>null)));document.querySelectorAll('.reveal').forEach(e=>{e.classList.remove('will-reveal');e.classList.add('is-visible');});});
  const state=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,broken:[...document.images].filter(i=>!i.naturalWidth).map(i=>i.getAttribute('src')),logos:document.querySelectorAll('.network-logo img').length,sections:[...document.querySelectorAll('main>section')].map(e=>({name:e.id||e.className,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})),mantech:{width:document.querySelector('[data-video="870918"] img').naturalWidth,height:document.querySelector('[data-video="870918"] img').naturalHeight,fit:getComputedStyle(document.querySelector('[data-video="870918"] img')).objectFit},soldier:{width:document.querySelector('.about-visual img').naturalWidth,height:document.querySelector('.about-visual img').naturalHeight},order:[...document.querySelector('main').children].filter(e=>e.tagName==='SECTION').map(e=>e.id||e.className)}));
  if(state.documentWidth>width+1||state.broken.length||state.logos!==10||errors.length)throw Error(JSON.stringify({width,state,errors}));
  await page.locator('[data-video="870918"]').click();
  await page.waitForSelector('#video-dialog[open]');
  state.videoFrame=await page.locator('#video-stage iframe').getAttribute('src');
  await page.locator('#video-dialog [data-close-dialog]').click();
  if(await page.locator('#video-stage iframe').count())throw Error('Video not cleaned up');
  if(width===390){await page.locator('.nav-toggle').click();state.mobileMenu=await page.locator('.nav-toggle').getAttribute('aria-expanded');await page.locator('.nav-toggle').click();}
  state.errors=errors;report.widths.push(state);
  if(width===1440){
   await page.addStyleTag({content:'.site-header{visibility:hidden!important}'});
   for(const [sel,name] of [['.hero','hero'],['#automotive','automotive'],['#government','government'],['#manufacturer-network','network'],['#capabilities-motion','motion'],['#about','about']])await page.locator(sel).screenshot({path:`preview-checks/${name}.png`});
  }
  await page.close();
 }
 report.passed=true;
}finally{
 await fs.writeFile('preview-checks/qa.json',JSON.stringify(report,null,2));
 await browser.close();server.close();
}
console.log('BROWSER_QA_PASSED '+JSON.stringify(report.widths.map(w=>({width:w.viewport,overflow:w.documentWidth-w.viewport,broken:w.broken.length,logos:w.logos,video:w.videoFrame,mantech:w.mantech,soldier:w.soldier}))));
