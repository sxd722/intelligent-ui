import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
const root='artifacts/rats-debug-qa'
const original=JSON.parse(await readFile('artifacts/rsi-adaptive/runs/2034bac5-9cd1-4c5e-8eb8-4d3d978079f8.json','utf8')).artifacts[0]
const source=original.source,context=original.spec.context
const card=compileCard(source,{final:true,context});await validateRichContent(card)
if(!card.complete)throw Error(JSON.stringify(card.diagnostics))
const click=(name,expect)=>({op:'click',name,...(expect?{expect}: {})})
const act=(name,expect)=>[click(name),click('推进时间',expect)]
const intro=[...act('阅读手稿',{state:{reads:1,notes:1,money:8}}),...act('阅读手稿',{state:{stage:2}})]
const explore=[...intro,...act('探查墙体',{state:{stage:3,sanity:5,clues:['manuscript','bones']},sandboxChanged:'priory'})]
const cases=[
 {id:'altar',steps:[...explore,...act('挥霍财力',{state:{money:6}}),...act('挥霍财力',{state:{money:4,stage:4},sandboxChanged:'priory'}),...act('深入地下',{state:{sanity:3}}),...act('深入地下',{state:{ending:'疯狂 · 祭坛之前',sanity:1}}),{op:'reload',expect:{state:{ending:'疯狂 · 祭坛之前',money:4}}},click('重新开始',{state:{stage:1,money:8,sanity:6,clues:[],ending:''}})]},
 {id:'bankruptcy',steps:[...explore,...act('挥霍财力',{state:{money:6}}),...act('挥霍财力',{state:{money:4}}),...act('挥霍财力',{state:{money:2}}),...act('挥霍财力',{state:{money:0,ending:'破产 · 流亡'}})]},
 {id:'sanity',steps:[...intro,...Array.from({length:6},(_,i)=>act('探查墙体',{state:{sanity:5-i,...(i===5?{ending:'疯狂 · 理智耗尽'}:{})}})).flat()]},
 {id:'clue-direct',steps:[...explore,click('白骨与鼠道',{state:{sel:'bones'},text:'塞满骸骨'}),click('返回桌面',{state:{sel:'',clues:['manuscript','bones']}}),click('收手离开',{state:{ending:'理性 · 及时收手'}})]},
 {id:'clue-navigation',steps:[...explore,click('白骨与鼠道',{state:{sel:'bones'}}),click('卡片页面：第 2 屏，共 2 屏',{text:'塞满骸骨'}),{op:'reload',expect:{state:{sel:'bones',clues:['manuscript','bones']},text:'塞满骸骨'}},click('返回桌面',{state:{sel:'',clues:['manuscript','bones']}}),click('收手离开',{state:{ending:'理性 · 及时收手'}})]},
 {id:'truth',steps:[...intro,...act('阅读手稿'),...act('阅读手稿',{state:{clues:['manuscript','truth'],reads:4}}),{op:'reload',expect:{state:{clues:['manuscript','truth'],reads:4,stage:2}}},click('收手离开',{state:{ending:'理性 · 及时收手'}})]},
]
const results=process.env.RATS_CASE?JSON.parse(await readFile(root+'/replay.json','utf8')):[]
for(const c of cases.filter(c=>!process.env.RATS_CASE||c.id===process.env.RATS_CASE)){
 const dir=root+'/replay/'+c.id;await mkdir(dir,{recursive:true});const start=Date.now()
 const browser=await runDebugBrowser(card.spec,{steps:c.steps,scenarios:['normal'],viewports:[432,320],size:'auto',captureSteps:true,artifactDir:dir})
 await writeFile(dir+'/trace.json',JSON.stringify(browser,null,2))
 const failures=browser.runs.flatMap(r=>r.actions.filter(a=>!a.ok||a.assertion?.passed===false||a.restored===false).map(a=>({width:r.width,step:a.step,error:a.error,assertion:a.assertion,observed:a.observed})))
 const errors=browser.runs.flatMap(r=>[...r.pageErrors,...r.initial.errors,...r.final.errors])
 const row={id:c.id,elapsedMs:Date.now()-start,passed:browser.status==='tested'&&!failures.length&&!errors.length,failures,errors,scope:'Original delivered source, no code changes; local built renderer; 432/320 auto, no real tools required'};results.push(row)
 await writeFile(root+'/replay.json',JSON.stringify(results,null,2));console.log(JSON.stringify({id:c.id,passed:row.passed,ms:row.elapsedMs,failures:failures.length,first:failures[0]?.assertion||failures[0]?.error}))
}
