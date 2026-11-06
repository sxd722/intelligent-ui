import {cp,readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {SANDBOX_RENDER_SCRIPT} from '../src/cardspec/sandbox-document.mjs'
const target='sites/intelligent-ui/'
for(const file of ['design-environment.js','graphic-surface.mjs','sandbox-document.mjs'])await cp('src/cardspec/'+file,target+'ui/src/cardspec/'+file)
for(const file of ['graphic-prompt.mjs','react-surface-prompt.mjs'])for(const prefix of ['ui/',''])await cp('shared/cardspec/'+file,target+prefix+'shared/cardspec/'+file)
const file=target+'ui/src/cardspec/sandbox-document.mjs';let s=await readFile(file,'utf8');const start=s.indexOf('export const SANDBOX_RENDER_SCRIPT='),end=s.indexOf('export function sandboxDocument',start)
await writeFile(file,s.slice(0,start)+'export const SANDBOX_RENDER_SCRIPT='+JSON.stringify(SANDBOX_RENDER_SCRIPT)+';\n'+s.slice(end))
const hash=createHash('sha256').update(SANDBOX_RENDER_SCRIPT).digest('base64')
for(const file of ['index.html','catalog.html','cardspec-lab.html','design-templates.html','pearl-review.html','reuse-check.html','reuse-review.html']){
 const p=target+'ui/'+file;const html=await readFile(p,'utf8');await writeFile(p,html.replace(/'sha256-[^']+'/g,"'sha256-"+hash+"'"))
}
console.log('Synced SVG surface and typography only; retained cloud generation services.')
