import fs from 'node:fs/promises'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
const root='artifacts/cuj-continuity-qa/host'
await fs.mkdir(root,{recursive:true})
const state='<state id="selected" type="string" initial="a" scope="deck"/><state id="marks" type="record" initial={{}} scope="deck"/>'
const sources=[`<card>${state}<title>主题</title><text id="result">{state.selected=="b"?"已选主题B":"已选主题A"} · {state.marks[state.selected]?"已掌握":"待学习"}</text><button label="选择主题B" onPress="select"/><action id="select"><set target="selected" value="b"/></action></card>`,
`<card>${state}<title>练习</title><text id="result">{state.selected=="b"?"主题B的题目":"主题A的题目"} · {state.marks[state.selected]?"已掌握":"待学习"}</text><button label="完成练习" onPress="mark"/><action id="mark"><set target="marks" key={state.selected} value={true}/></action></card>`]
const deck=sources.map((source,i)=>{const r=compileCard(source,{final:true,cardId:'cuj-host-'+i,context:{expressionDialect:'js-v1',renderMode:'native'}});if(!r.complete)throw Error(JSON.stringify(r.diagnostics));return {id:r.spec.cardId,title:i?'练习':'主题',spec:r.spec,source,status:'ready'}})
const steps=[{op:'click',name:'选择主题B',expect:{text:'已选主题B'}},{op:'click',name:'卡片页面：第 2 屏，共 2 屏',expect:{text:'主题B的题目'}},{op:'click',name:'完成练习',expect:{text:'已掌握'}},{op:'click',name:'卡片页面：第 1 屏，共 2 屏',expect:{text:['已选主题B','已掌握']}},{op:'reload',expect:{text:['已选主题B','已掌握']}},{op:'click',name:'卡片页面：第 2 屏，共 2 屏',expect:{text:['主题B的题目','已掌握']}}]
const result=await runDebugBrowser(deck[0].spec,{deck,steps,scenarios:['normal'],viewports:[320,432],size:'auto',artifactDir:root,captureSteps:true,signal:AbortSignal.timeout(60000)})
await fs.writeFile(root+'/result.json',JSON.stringify({deck,steps,...result},null,2))
console.log(JSON.stringify({status:result.status,reason:result.reason,runs:result.runs?.map(r=>({width:r.width,errors:r.pageErrors,actions:r.actions.map(a=>({name:a.step.name||a.step.op,ok:a.ok,assertion:a.assertion,error:a.error,restored:a.restored}))}))},null,2))
