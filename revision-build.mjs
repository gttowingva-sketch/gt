import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const output='dist';
await fs.rm(output,{recursive:true,force:true});
await fs.mkdir(`${output}/assets`,{recursive:true});
let html=await fs.readFile('index.html','utf8');
if(!html.includes('id="inquiry-form"')||!html.includes('ENGINEERED PARTS.')) throw Error('Unexpected baseline; refusing to modify a different site.');
const manifest=[];
const offline=process.env.MRW_LOCAL_TEST==='1';
async function remote(url){
 const r=await fetch(url,{headers:{'User-Agent':'MRWheelsWebsitePreview/1.0 (info@mr-wheels.com)'},signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw Error(`HTTP ${r.status}: ${url}`);
 return {bytes:Buffer.from(await r.arrayBuffer()),url:r.url,type:r.headers.get('content-type')||''};
}
async function asset(name,urls,svg=false){
 if(offline){manifest.push({name,source:urls[0],localTest:true});return;}
 try{const cached=await fs.readFile(`revision-assets/${name}`);if(cached.length>100){await fs.writeFile(`${output}/assets/${name}`,cached);manifest.push({name,source:'verified repository cache',bytes:cached.length});console.log(`ASSET_CACHED ${name} ${cached.length}`);return;}}catch(_){}
 let last;
 for(const url of urls){
  try{
   const a=await remote(url);
   if(a.bytes.length<100|| (svg&&!a.bytes.toString('utf8').includes('<svg'))||a.type.includes('text/html'))throw Error(`Not an image: ${url}`);
   await fs.writeFile(`${output}/assets/${name}`,a.bytes);
   manifest.push({name,source:a.url,bytes:a.bytes.length,sha256:createHash('sha256').update(a.bytes).digest('hex')});
   console.log(`ASSET_OK ${name} ${a.bytes.length} ${a.url}`);return;
  }catch(e){last=e;}
 }
 throw Error(`Required asset ${name} could not be retrieved: ${last}`);
}
function commons(file){const f=file.replaceAll(' ','_');const h=createHash('md5').update(f).digest('hex');return `https://upload.wikimedia.org/wikipedia/commons/${h[0]}/${h.slice(0,2)}/${encodeURIComponent(f)}`;}
const brands=[
 ['caterpillar','Caterpillar','Caterpillar logo.svg'],
 ['bosch','Bosch','Bosch-logo.svg'],
 ['zf','ZF','ZF logo STD Blue 3CC.svg'],
 ['timken','Timken','Timken.svg'],
 ['denso','Denso','Denso logo.svg'],
 ['cummins','Cummins','Cummins logo.svg'],
 ['lockheed-martin','Lockheed Martin','Lockheed Martin logo (2011–2022).svg'],
 ['boeing','Boeing','Boeing full logo.svg'],
 ['rolls-royce','Rolls-Royce','Rolls-Royce Group logo.svg'],
 ['general-dynamics','General Dynamics','General Dynamics logo.svg']
];
for(const [id,name,file] of brands){
 const urls=[commons(file),`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replaceAll(' ','_'))}`];
 if(id==='rolls-royce')urls.unshift('https://www.rolls-royce.com/~/media/Images/R/Rolls-Royce/logo/rebrand-svg-logo.svg');
 await asset(`${id}.svg`,urls,true);
}
await asset('mantech-full.jpg',['https://pit.army.mil/wp-content/uploads/2025/09/dod-mantech-logo.png','https://media.defense.gov/2023/Jun/20/2003244421/-1/-1/0/230620-D-TJ319-001.JPG','https://media.defense.gov/2021/Jul/29/2003678653/-1/-1/0/210729-O-MF577-1256.JPG']);
const soldier=await fs.readFile('about-soldier.avif');
if(createHash('sha256').update(soldier).digest('hex')!=='f5ae487000d370c058fd536ff8b90c3fba3c5a0a44e505e497b40289c27b984b')throw Error('Soldier image checksum mismatch; refusing corrupt asset.');
await fs.writeFile(`${output}/assets/about-soldier.avif`,soldier);
await fs.copyFile('network-world.svg',`${output}/assets/network-world.svg`);
const copyNames=['hero-military-vehicles-v2.webp','motion-armored-vehicle.webp','motion-global-logistics.jpg'];
for(const name of copyNames){
 try{await fs.copyFile(name,`${output}/assets/${name}`);}catch(e){if(!offline)throw e;}
}
// Use complete source originals rather than repeatedly shrinking a pre-cropped image.
function src(tag,url){return tag.replace(/\bsrc="[^"]*"/,`src="${url}"`).replace(/\sdata-original-hero="[^"]*"/,'');}
html=html.replace(/<img\b[^>]*\bid="lead-image"[^>]*>/,t=>src(t,'assets/hero-military-vehicles-v2.webp'));
html=html.replace(/<img\b[^>]*alt="Manufacturing Technology Program[^"]*"[^>]*>/,t=>src(t,'assets/mantech-full.jpg'));
html=html.replace(/<img\b[^>]*alt="Armored vehicle sustainment[^"]*"[^>]*>/,t=>src(t,'assets/motion-armored-vehicle.webp'));
html=html.replace(/<img\b[^>]*alt="Military cargo delivery[^"]*"[^>]*>/,t=>src(t,'assets/motion-global-logistics.jpg'));
// Preserve every section; relocate the existing mission case and six icons below About.
function takeSection(className){
 const re=new RegExp(`<section\\b[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>[\\s\\S]*?<\\/section>`);
 const match=html.match(re);if(!match)throw Error(`Section not found: ${className}`);
 html=html.replace(match[0],'');return match[0];
}
const band=takeSection('mission-separator');
const mission=takeSection('mission');
html=html.replace(/(<section\b[^>]*id="about"[^>]*>[\s\S]*?<\/section>)/,`$1\n${mission}\n${band}`);
const visual='<figure class="about-visual"><img src="assets/about-soldier.avif" width="706" height="299" loading="lazy" decoding="async" alt="Illustrative soldier facing a sunset: quality, accountability, global impact and mission readiness"></figure>';
html=html.replace(/(<div class="about-brand-line")/,`${visual}\n$1`);
const logoItems=brands.map(([id,name])=>`<div class="network-logo" data-brand="${id}" title="${name}"><img src="assets/${id}.svg" alt="${name}" loading="lazy" decoding="async"></div>`).join('');
const network=`<section class="manufacturer-network" id="manufacturer-network" aria-labelledby="network-title"><img class="network-world" src="assets/network-world.svg" alt="" aria-hidden="true"><div class="network-content"><div class="network-copy"><p class="eyebrow"><span></span>MANUFACTURER &amp; SOURCING NETWORK</p><h2 id="network-title">Stronger together.</h2><p>Representative manufacturers across the markets and product families we source.</p></div><div class="network-logos" aria-label="Manufacturer logos">${logoItems}</div><a class="button button-outline network-cta" href="#contact" data-inquiry="Supplier partnership">PARTNER WITH US <span aria-hidden="true">↗</span></a></div><p class="network-legal">Manufacturer trademarks belong to their respective owners. Shown for sourcing context only, not as endorsements or formal partnerships. Availability and authorization vary by requirement.</p></section>`;
html=html.replace(/(<section\b[^>]*id="suppliers"[^>]*>[\s\S]*?<\/section>)/,`$1\n${network}`);
html=html.replace('<body>','<body class="mrw-v7">').replace('content="index,follow" name="robots"','content="noindex,nofollow" name="robots"');
html=html.replace('</head>',`<style id="mrw-v7-layout">${await fs.readFile('revision.css','utf8')}</style><meta name="mrwheels-build" content="fullwidth-v7-20260930"></head>`);
// Losslessly externalize embedded images into this preview's own assets directory.
const inline=[...html.matchAll(/src="(data:image\/(\w[\w+.-]*);base64,([A-Za-z0-9+/=\s]+))"/g)];
for(const m of inline){
 const bytes=Buffer.from(m[3],'base64'),ext=m[2]==='svg+xml'?'svg':m[2]==='jpeg'?'jpg':m[2];
 const name=`embedded-${createHash('sha256').update(bytes).digest('hex').slice(0,14)}.${ext}`;
 await fs.writeFile(`${output}/assets/${name}`,bytes);html=html.replaceAll(m[1],`assets/${name}`);
}
if(!html.includes('assets/mantech-full.jpg')||!html.includes('about-visual'))throw Error('Required visual replacement did not match.');
await fs.writeFile(`${output}/index.html`,html);
await fs.writeFile(`${output}/asset-sources.json`,JSON.stringify({build:'fullwidth-v7-20260930',purpose:'Design preview; trademark permissions must be reviewed before public launch.',assets:manifest},null,2));
await fs.writeFile(`${output}/robots.txt`,'User-agent: *\nDisallow: /\n');
console.log(`BUILD_OK ${html.length} bytes; ${brands.length} logos; localTest=${offline}.`);
