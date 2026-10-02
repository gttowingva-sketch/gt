import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
// Run the unchanged live-site build first. This module only adds the approved band.
await import('./refinement-build.mjs');
const before=await fs.readFile('dist/index.html','utf8');
if(before.includes('id="automotive-network"'))throw Error('Automotive network already exists: refusing to duplicate it.');
const section=await fs.readFile('automotive-network.html','utf8');
const css=await fs.readFile('automotive-network.css','utf8');
const marker=/<div\b(?=[^>]*\bclass="section-bridge bridge-long")[^>]*><span><\/span><\/div>(?=<section\b[^>]*\bid="government")/;
const match=before.match(marker);
if(!match)throw Error('Expected Automotive / Government transition not found. No output was changed.');
if(before.lastIndexOf('id="automotive"',match.index)<0)throw Error('Automotive section not found before insertion.');
const style=`<style id="mrw-automotive-network-css">${css}</style>`;
const after=before.replace(marker,section).replace('</head>',style+'</head>');
if(after.replace(section,match[0]).replace(style,'')!==before)throw Error('Unrelated content changed.');
const manifest=JSON.parse(await fs.readFile('automotive-network-manifest.json','utf8'));
if(manifest.logos.length!==10)throw Error('Exactly ten approved logos are required.');
await fs.mkdir('dist/assets/automotive-network',{recursive:true});
for(const logo of manifest.logos){
 const bytes=await fs.readFile(`automotive-network-assets/${logo.id}.png`);
 if(createHash('sha256').update(bytes).digest('hex')!==logo.sha256)throw Error(`Logo checksum mismatch: ${logo.id}`);
 await fs.writeFile(`dist/assets/automotive-network/${logo.id}.png`,bytes);
}
await fs.writeFile('dist/index.html',after);
await fs.writeFile('dist/automotive-network-status.json',JSON.stringify({
 revision:'automotive-network-20261002',approvedLogoCount:10,
 placement:'After Automotive cards; before Government Supply',
 originalPageUnchangedOutsideNewBand:true,
 approvedSourceSha256:manifest.approvedSourceSha256,
 baselineSha256:createHash('sha256').update(before).digest('hex'),
 pageSha256:createHash('sha256').update(after).digest('hex')
},null,2));
console.log('AUTOMOTIVE_NETWORK_OK: 10 exact approved logo crops; real HTML text; original page otherwise unchanged.');
