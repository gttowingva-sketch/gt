import fs from 'node:fs/promises';
const lines=[];
const original=console.log;
console.log=(...args)=>{lines.push(args.join(' '));original(...args);};
try {
 await import('./revision-build.mjs');
 await fs.writeFile('dist/build-diagnostic.txt','SUCCESS\n'+lines.join('\n'));
} catch(e) {
 await fs.mkdir('dist',{recursive:true});
 const message='PREVIEW BUILD DIAGNOSTIC\n'+lines.join('\n')+'\n'+String(e.stack||e);
 console.error(message);
 await fs.writeFile('dist/build-diagnostic.txt',message);
 await fs.writeFile('dist/index.html','<!doctype html><html><head><meta name="robots" content="noindex,nofollow"><title>Preview build check</title></head><body><p>Preview validation is in progress.</p></body></html>');
}
