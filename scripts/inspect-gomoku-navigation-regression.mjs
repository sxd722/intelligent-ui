import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {pathToFileURL} from 'node:url'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
const root=resolve('artifacts/gomoku-harness-review');await mkdir(root,{recursive:true})
const candidate='artifacts/generation-debug/afe8bfd9-d048-43bd-8072-c72548e7578d/c981635a61402de49738'
const source=await readFile(candidate+'/candidate.cardspec','utf8'),record=JSON.parse(await readFile(candidate+'/test-2.json','utf8'))
const compiled=compileCard(source,{final:true,context:{renderMode:'web',expressionDialect:'js-v1',cardSize:'auto'}});await validateRichContent(compiled)
await writeFile(root+'/compile.json',JSON.stringify({complete:compiled.complete,diagnostics:compiled.diagnostics},null,2))
if(!compiled.complete)throw Error('Candidate no longer compiles')
const entry=resolve('server/cardspec/debug-browser.mjs'),original=await readFile(entry,'utf8')
for(const mode of process.argv.includes('--fixed')?['fixed']:['current-observe','without-frame-navigation-read']){
 let code=original.replace(/from '(\.[^']+)'/g,(_,rel)=>`from '${pathToFileURL(resolve(dirname(entry),rel)).href}'`).replace("new URL('../../dist/',import.meta.url)",`new URL('${pathToFileURL(resolve('dist')+'/').href}')`)
 // Reconstruct the one-line historical regression for a repeatable A/B even
 // after the production runner has been fixed. Never change card source.
 if(mode!=='fixed')code=code.replace(/try\{value\.navigation\.push\(\.\.\.await frame\.locator\('html'\).*?\n\s*catch\(e\)\{value\.warnings=.*?\}/,'value.navigation.push(...await frame.evaluate(()=>window.__cardNavigation||[]))')
 code=code.replace('}catch{/* A removed frame will be represented by the host error/status. */}',"}catch(e){value.hostObservationErrors=[...(value.hostObservationErrors||[]),String(e.stack||e)]}")
 if(mode==='without-frame-navigation-read')code=code.replace('value.navigation.push(...await frame.evaluate(()=>window.__cardNavigation||[]))','// A/B: remove only the added frame navigation read')
 const moduleFile=root+'/'+mode+'.mjs';await writeFile(moduleFile,code)
 const {runDebugBrowser}=await import(pathToFileURL(moduleFile))
 const result=await runDebugBrowser(compiled.spec,{steps:record.steps,scenarios:['normal'],viewports:[320,432],size:'auto',captureSteps:true,artifactDir:root+'/'+mode})
 await writeFile(root+'/'+mode+'.json',JSON.stringify(result,null,2))
 console.log(JSON.stringify({mode,runs:result.runs.map(r=>({width:r.width,initialText:r.initial.text?.slice(0,240),initialControls:r.initial.controls?.length,observationErrors:r.initial.hostObservationErrors,actions:r.actions.map(a=>({name:a.step.name,ok:a.ok,assertion:a.assertion,text:a.observed?.text?.slice(-250)}))}))}))
}
