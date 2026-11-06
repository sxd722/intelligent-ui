import assert from 'node:assert/strict'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
const root=resolve('artifacts/debug-convergence-qa');await mkdir(root,{recursive:true})
const jsx=`import React from 'react';export default function App({state,setState}){const n=state.n||0;return <div style={{padding:16}}><h2>随机练习与多步恢复</h2><p>计数 {n}</p><p>抽样 {state.draw||'未抽取'}</p><button onClick={()=>setState({...state,n:n+1,draw:Math.floor(Math.random()*10000)})}>继续</button><div style={{height:88,overflow:'auto',marginTop:12}}><div style={{height:160}}>可滚动记录</div><p>记录末尾</p></div></div>}`
const source='<card><sandbox id="sample" height={280} brief="随机练习" source={'+JSON.stringify(jsx)+'}/></card>'
const result=compileCard(source,{final:true,context:{renderMode:'web',expressionDialect:'js-v1'}});await validateRichContent(result);assert.equal(result.complete,true)
const steps=[{op:'click',name:'继续',requirement:'R1',expect:{text:'计数 1',changed:true}},{op:'click',name:'继续',requirement:'R2',expect:{text:'计数 2',changed:true}},{op:'reload',expect:{text:'计数 2',changed:false}}]
const reports=[]
for(const [label,seed]of [['first',73129],['repeat',73129],['alternate',73130]]){
 const browser=await runDebugBrowser(result.spec,{scenarios:['normal'],steps,seed,artifactDir:resolve(root,label)})
 await writeFile(resolve(root,label+'.json'),JSON.stringify(browser,null,2))
 assert.equal(browser.status,'tested')
 for(const run of browser.runs){assert.equal(run.actions.length,3);assert.ok(run.actions.every(a=>a.ok&&a.assertion?.passed&&a.restored!==false),JSON.stringify(run.actions));assert.equal(run.final.layout.issues.length,0,JSON.stringify(run.final.layout.issues))}
 reports.push(browser)
}
const draw=r=>r.runs.map(run=>run.final.text.match(/抽样\s*(\d+)/)?.[1])
assert.deepEqual(draw(reports[0]),draw(reports[1]));assert.notDeepEqual(draw(reports[0]),draw(reports[2]));assert.equal(draw(reports[0])[0],draw(reports[0])[1])
// Inspect original interrupted candidate without changing source or claiming rules verified.
const saved=JSON.parse(await readFile('artifacts/sgs-manual-preview/spec.json','utf8'))
const original=await runDebugBrowser(saved,{scenarios:['normal'],steps:[{op:'check'}],artifactDir:resolve(root,'original')})
await writeFile(resolve(root,'original.json'),JSON.stringify(original,null,2));assert.equal(original.status,'tested')
const summary={status:'passed',scope:'Seed reproducibility, two-step interaction and reload at 320/432; original candidate render only',draws:reports.map(draw),original:original.runs.map(r=>({width:r.width,errors:r.final.errors,controls:r.final.controls.map(c=>c.name),layout:r.final.layout.issues.map(i=>({code:i.code,element:i.element,overflow:i.overflow}))}))}
await writeFile(resolve(root,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary))
