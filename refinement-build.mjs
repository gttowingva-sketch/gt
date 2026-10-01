import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
await import('./revision-build.mjs');
let html=await fs.readFile('dist/index.html','utf8');
if(!html.includes('fullwidth-v7-20260930'))throw Error('V7 baseline missing');
const baseline=html;
await fs.writeFile('dist/v7-baseline.html',baseline);
html=html.replace('class="mrw-v7"','class="mrw-v7 mrw-v8"');
html=html.replace(/<figure class="about-visual">[\s\S]*?<\/figure>/g,'');
let flagChanged=false;
html=html.replace(/(<div class="mission-flag">[\s\S]*?<\/div>)/,block=>{if(!block.includes('MISSION READY'))throw Error('Unexpected flag label');flagChanged=true;return block.replace(/<br\s*\/?>\s*MISSION READY/,'');});
if(!flagChanged)throw Error('Flag was not located');
const art=(cls,file)=>`<div class="${cls}" aria-hidden="true"><img src="assets/${file}" alt="" loading="lazy" decoding="async"></div>`;
html=html.replace(/(<section\b[^>]*class="[^"]*process-section[^"]*"[^>]*>)/,`$1${art('process-art','soldier-sunset-clean.webp')}<div class="process-shade" aria-hidden="true"></div>`);
html=html.replace(/(<section\b[^>]*id="about"[^>]*>)/,`$1${art('about-backdrop','about-clean-aerial-final.png')}<div class="about-shade" aria-hidden="true"></div>`);
const plane=html.match(/<div class="[^"]*government-art[^"]*">\s*<img[^>]*src="([^"]+)"/);
if(!plane)throw Error('Aircraft source not located');
html=html.replace(/(<div class="[^"]*government-art[^"]*">)/,`<div class="government-backdrop" aria-hidden="true" style="background-image:url('${plane[1]}')"></div>$1`);
// Existing click handlers stay attached to the original buttons.
let cards=0;
html=html.replace(/(<button\b[^>]*class="motion-media"[^>]*>\s*)(<img\b[^>]*>)/g,(all,open,img)=>{
 cards++;const ambience=img.replace(/class="[^"]*"/,'class="media-ambience"').replace(/alt="[^"]*"/,'alt="" aria-hidden="true"');
 return `${open}<span class="motion-stage">${ambience}${img}</span>`;
});
if(cards!==4)throw Error(`Expected 4 original motion covers; got ${cards}`);
const focus=[
 ['Land','GROUND SYSTEMS','<path d="M11 30h42l7 7H4zM18 28l4-10h23l7 10zM29 17v-6h11v6h-11M40 13h23v4H40zM9 38h44a7 7 0 0 1 0 14H9a7 7 0 0 1 0-14z"/><g fill="#0a1115"><circle cx="11" cy="45" r="3"/><circle cx="21" cy="45" r="3"/><circle cx="31" cy="45" r="3"/><circle cx="41" cy="45" r="3"/><circle cx="51" cy="45" r="3"/></g>'],
 ['Air','AEROSPACE PARTS','<path d="M30 3q2-4 4 0l3 19 26 14v7l-27-7 1 14 9 7v5l-14-4-14 4v-5l9-7 1-14-27 7v-7l26-14z"/>'],
 ['Sea','MARITIME SUPPLY','<path d="M3 37h58l-8 16H10zM12 35V23h40v12zM21 21V13h22v8zM30 11V2h4v9zM41 16h16v3H41z"/><path d="M4 58q7-4 14 0 7-4 14 0 7-4 14 0 7-4 14 0" fill="none" stroke="currentColor" stroke-width="3"/>'],
 ['Supply','PARTS & COMPONENTS','<path d="m7 16 25-12 25 12v35L32 62 7 51z" fill="none" stroke="currentColor" stroke-width="3"/><path d="m8 16 24 12 24-12M32 28v33M17 26v21M24 30v20M40 30v20M47 26v21" fill="none" stroke="currentColor" stroke-width="3"/>'],
 ['Support','LOGISTICS & LIFECYCLE','<path fill-rule="evenodd" d="m27 2-2 8-7 3-7-4-7 9 6 6-1 8-8 4 4 11 9-1 6 5 1 9h12l2-8 7-3 8 4 7-9-6-7 1-7 8-4-4-11-9 1-6-5-1-9zm4 17a13 13 0 1 0 0 26 13 13 0 0 0 0-26z"/>'],
 ['Global','WORLDWIDE REACH','<circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" stroke-width="3"/><ellipse cx="32" cy="32" rx="13" ry="27" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M5 32h54M10 18h44M10 46h44" fill="none" stroke="currentColor" stroke-width="2.5"/>']
];
const icons=focus.map(([name,sub,paths])=>`<div class="mission-icon"><svg class="focus-symbol" viewBox="0 0 64 64" aria-hidden="true">${paths}</svg><span class="focus-label">${name.toUpperCase()}<small>${sub}</small></span></div>`).join('');
html=html.replace(/<div class="mission-icons">[\s\S]*?<\/div>\s*(<div class="mission-flag">)/,`<div class="mission-icons">${icons}</div>$1`);
try{
 await fs.copyFile('revision-assets/inspection-original.webp','dist/assets/inspection-original.webp');
 html=html.replace(/<img\b[^>]*alt="Inspection and production[^"]*"[^>]*>/,t=>t.replace(/\bsrc="[^"]*"/,'src="assets/inspection-original.webp"'));
}catch(_){}
const brands=['caterpillar','bosch','zf','timken','denso','cummins','lockheed-martin','boeing','rolls-royce','general-dynamics'];
for(const brand of brands){const name=`${brand}-optical.png`;await fs.copyFile(`revision-assets/${name}`,`dist/assets/${name}`);html=html.replaceAll(`src="assets/${brand}.svg"`,`src="assets/${name}"`);}
await fs.copyFile('revision-assets/warehouse-scene.webp','dist/assets/warehouse-scene.webp');
await fs.copyFile('revision-assets/about-aerial-v10.jpg','dist/assets/about-aerial-v10.jpg');
await fs.copyFile('revision-assets/about-clean-aerial-final.png','dist/assets/about-clean-aerial-final.png');
const soldierB64=(await Promise.all([0,1,2,3].map(i=>fs.readFile(`revision-assets/soldier-v9.part${i}`,'utf8')))).join('');
const soldierBytes=Buffer.from(soldierB64,'base64');
if(soldierBytes.length<25000) throw Error('Approved soldier background asset incomplete');
await fs.writeFile('dist/assets/soldier-v9-exact.webp',soldierBytes);
html=html.replaceAll('assets/soldier-sunset-clean.webp','assets/soldier-v9-exact.webp');
html=html.replace('</head>',`<style id="mrw-v8-refinements">${await fs.readFile('refinement.css','utf8')}</style><meta name="mrwheels-revision" content="refined-v8-20260930"></head>`);
if(await fs.stat('refinement-fixes.css').catch(()=>null))html=html.replace('</head>',`<style id="mrw-v8-render-fixes">${await fs.readFile('refinement-fixes.css','utf8')}</style></head>`);
// V9 layout: use the icon/focus strip as breathing room between About and Mission.
const sepMatch=html.match(/<section\b[^>]*class="[^"]*mission-separator[^"]*"[^>]*>[\s\S]*?<\/section>/);
const missionMatch=html.match(/<section\b[^>]*class="[^"]*\bmission\b[^"]*"[^>]*>/);
if(sepMatch && missionMatch){ html=html.replace(sepMatch[0],''); const mi=html.indexOf(missionMatch[0]); if(mi>=0) html=html.slice(0,mi)+sepMatch[0]+html.slice(mi); }
const v11SupplyExtras={
 'LAND SYSTEMS':['Road Wheels','Wheel & Hub Assemblies','Drivetrain Components'],
 'AEROSPACE':['Actuation Components','Flight Controls','Structural Hardware','Aerospace Fasteners'],
 'MECHANICAL':['Bushings','Shafts & Couplings','Precision Hardware','Springs'],
 'FLUID & SEALING':['O-Rings','Fluid Connectors','Valves & Fittings','Pressure Components'],
 'ELECTRICAL':['Connectors','Relays & Switches','Power Distribution','Circuit Protection','Terminal Blocks'],
 'INDUSTRIAL':['Industrial Hoses','Abrasives & Cutting Tools','Material Handling','Maintenance Supplies','Shop Equipment']
};
const v11ClientScript='<script id="mrw-v11-supply-tags">document.addEventListener("DOMContentLoaded",()=>{const extras='+JSON.stringify(v11SupplyExtras)+';for(const h of document.querySelectorAll(".category-card h3")){const key=(h.textContent||"").trim().toUpperCase();if(!extras[key])continue;const card=h.closest(".category-card");const box=card?.querySelector(".product-tags");if(!box)continue;card.classList.add("supply-tuned-card");box.classList.add("supply-tags-v11");const existing=new Set([...box.children].map(e=>(e.textContent||"").trim()));for(const label of extras[key]){if(existing.has(label))continue;const li=document.createElement("li");li.textContent=label;box.appendChild(li);}}});<\/script>';
html=html.replace('</body>',v11ClientScript+'</body>');
html=html.replaceAll('viewbox=','viewBox=');
html=html.replaceAll('content="noindex,nofollow" name="robots"','content="index,follow" name="robots"');
html=html.replaceAll('content="noindex, nofollow" name="robots"','content="index,follow" name="robots"');
await fs.writeFile('dist/robots.txt','User-agent: *\nAllow: /\nSitemap: https://www.mr-wheels.com/sitemap.xml\n');
await fs.writeFile('dist/index.html',html);
await fs.writeFile('dist/revision-status.json',JSON.stringify({revision:'refined-v8-20260930',baseline:'4c707c8b3f14890d20fffc29158ea362713de4c1',motionCards:cards,logos:brands.length,liveSiteChanged:false,sha256:createHash('sha256').update(html).digest('hex')},null,2));
console.log('V8_HTML_READY: targeted revisions only; original content and interactions retained.');
