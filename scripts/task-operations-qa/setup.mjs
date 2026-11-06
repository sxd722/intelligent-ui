import {mkdir,writeFile} from 'node:fs/promises'
import {build} from 'esbuild'
import {compileCard} from '../../shared/cardspec/compiler.mjs'
import {CASES,ROOT,DEST,nativeSource} from './cases.mjs'
await mkdir(ROOT,{recursive:true});await mkdir(DEST+'/runs',{recursive:true})
await build({entryPoints:['scripts/task-operations-qa/viewer.jsx'],bundle:true,format:'esm',platform:'browser',outfile:DEST+'/viewer.js',define:{'process.env.NODE_ENV':'"production"'},loader:{'.woff2':'file','.woff':'file','.ttf':'file','.png':'file'},logLevel:'error'})
await writeFile(DEST+'/viewer.html','<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="viewer.css"><style>body{margin:0;padding:18px;background:#e5ebf0;font-family:system-ui}main{margin:auto}</style><div id="root"></div><script type="module" src="viewer.js"></script>')
for(const c of CASES){const source=nativeSource(c),r=compileCard(source,{final:true,cardId:'task-'+c.id,context:{expressionDialect:'js-v1'}});if(!r.complete)throw Error(JSON.stringify(r.diagnostics));await writeFile(DEST+'/runs/'+c.id+'.json',JSON.stringify({case:c.id,spec:r.spec,source}));await writeFile(ROOT+'/'+c.id+'.cardspec',source)}
console.log('Built 6 host-native task cases')
