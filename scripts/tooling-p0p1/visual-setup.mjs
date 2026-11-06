import {mkdir,writeFile} from 'node:fs/promises'
import {build} from 'esbuild'
import {compileCard} from '../../shared/cardspec/compiler.mjs'
import {cases,families,formats} from './visual-cases.mjs'
const dir='dist/tooling-p0p1';await mkdir(dir+'/runs',{recursive:true})
for(const c of cases)for(const family of families)for(const format of formats){
 const id=[c.id,family,format].join('-'),source=`<card schemaVersion="1" design="business"><tool-view id="view" tool="${c.tool}" input={${JSON.stringify(c.input)}} style="${family}" format="${format}" label="${c.id}"/></card>`,r=compileCard(source,{final:true,cardId:id,context:{expressionDialect:'js-v1'}})
 if(!r.complete)throw Error(id+JSON.stringify(r.diagnostics));await writeFile(dir+'/runs/'+id+'.json',JSON.stringify({id,case:c.id,spec:r.spec,source}))
}
await build({entryPoints:['scripts/tooling-p0p1/visual-viewer.jsx'],bundle:true,format:'esm',platform:'browser',outfile:dir+'/viewer.js',define:{'process.env.NODE_ENV':'"production"'},loader:{'.woff2':'file','.ttf':'file','.woff':'file','.png':'file'},logLevel:'error'})
await writeFile(dir+'/viewer.html','<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="viewer.css"><style>body{margin:0;padding:12px;background:#dfe4e8;font-family:system-ui}main{margin:auto}</style><div id="root"></div><script type="module" src="viewer.js"></script>')
console.log('80 native tool-view specifications compiled')
