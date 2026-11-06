import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createBuildWorkspace} from '../server/cardspec/build-workspace.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
const id=process.argv[2]||'904b36d3-a420-40e8-a5e2-1daeac9a463a',label=process.argv[3]||'before'
if(!/^[\w-]+$/.test(label)||!/^[a-f0-9-]{36}$/.test(id))throw Error('invalid arguments')
const dir=`artifacts/sgs-harness-20261102/${label}`;await mkdir(dir,{recursive:true})
const trace=JSON.parse(await readFile(`artifacts/deep-build/${id}/trace.json`,'utf8')),workspace=createBuildWorkspace({extendedGeneration:true})
workspace.write(Object.entries(trace.workspace).map(([name,v])=>({name,content:v.content})))
const source=workspace.assemble().source,compiled=compileCard(source,{final:true,context:{renderMode:'web',expressionDialect:'js-v1',cardSize:'full'}});await validateRichContent(compiled)
if(!compiled.complete)throw Error(JSON.stringify(compiled.diagnostics))
await writeFile(dir+'/source.cardspec',source);await writeFile(dir+'/spec.json',JSON.stringify(compiled.spec))
const card=n=>({n,s:'♠'}),deck=Array.from({length:16},(_,i)=>card(i%3?'闪':'杀'))
const base=()=>({started:true,over:null,player:{name:'关羽',hp:4,max:4,emoji:'🗡️'},ai:{name:'曹操',hp:4,max:4,emoji:'👑'},hand:['杀','桃','闪'].map(card),aiHandArr:[],deck,discard:[],center:null,pending:null,shaUsed:false,turn:'player',sel:-1,log:['独立QA边界状态']})
const click=(name,extra={})=>({op:'click',name,...extra}),reload={op:'reload',expect:{changed:false}}
const game=s=>Object.values(s.componentState||{}).find(c=>c.webSandbox)?.webSandbox.state
const cases=[
 {id:'play-restore',initial:base(),steps:[click('杀'),click('出 牌',{waitMs:1200}),reload],check:s=>s.ai.hp===3&&s.shaUsed&&s.hand.length===2&&s.player.hp===4},
 {id:'heal',initial:{...base(),player:{...base().player,hp:3}},steps:[click('桃'),click('出 牌',{waitMs:1200}),reload],check:s=>s.player.hp===4&&s.hand.length===2},
 {id:'extra-card',initial:{...base(),hand:[card('过河拆桥')],aiHandArr:[card('杀'),card('桃')]},steps:[click('过河拆桥'),click('出 牌',{waitMs:1200})],check:s=>s.hand.length===0&&s.aiHandArr.length===1&&s.discard.length===2},
 {id:'ai-autonomy',initial:{...base(),aiHandArr:[card('杀')]},steps:[click('结束回合',{waitMs:2300}),click('使用【闪】',{waitMs:2000}),reload],check:s=>s.turn==='player'&&!s.pending&&s.player.hp===4&&s.hand.length===4&&s.deck.length===12&&s.log.some(l=>l.includes('摸'))},
 {id:'win',initial:{...base(),ai:{...base().ai,hp:1}},steps:[click('杀'),click('出 牌',{waitMs:1200}),reload],check:s=>s.over==='win'&&s.ai.hp===0&&s.hand.length===2},
 {id:'lose',initial:{...base(),player:{...base().player,hp:1},turn:'ai',pending:{type:'sha',from:'ai'}},steps:[click('承受伤害',{waitMs:2200}),reload],check:s=>s.over==='lose'&&s.player.hp===0&&s.hand.length===3&&s.deck.length===16},
 {id:'pending-restore',initial:{...base(),turn:'ai',pending:{type:'sha',from:'ai'},aiHandArr:[card('桃')]},steps:[{op:'reload',waitMs:2500}],check:s=>s.pending?.type==='sha'&&s.aiHandArr.length===1&&s.deck.length===16&&s.player.hp===4},
 {id:'restart',initial:{...base(),over:'win',ai:{...base().ai,hp:0}},steps:[click('再 来 一 局'),reload],check:s=>s.started&&!s.over&&s.player.hp===s.player.max&&s.ai.hp===s.ai.max&&s.turn==='player'&&!s.pending},
 {id:'draw-stage-restore',initial:{...base(),aiHandArr:[card('杀')]},steps:[click('结束回合'),{op:'reload',waitMs:2400}],check:s=>s.pending?.type==='sha'&&s.aiHandArr.length===2&&s.deck.length===14&&s.hand.length===3},
 {id:'decide-stage-restore',initial:{...base(),turn:'ai',aiPhase:'decide',aiHandArr:[card('杀')]},steps:[{op:'reload',waitMs:2100}],check:s=>s.pending?.type==='sha'&&s.aiHandArr.length===0&&s.deck.length===16&&s.hand.length===3},
 {id:'finish-stage-restore',initial:{...base(),turn:'ai',aiPhase:'respond',pending:{type:'sha',from:'ai'}},steps:[click('使用【闪】'),{op:'reload',waitMs:2500},reload],check:s=>s.turn==='player'&&!s.pending&&s.hand.length===4&&s.deck.length===14&&s.player.hp===4},
 {id:'ai-heal',initial:{...base(),turn:'ai',aiPhase:'decide',ai:{...base().ai,hp:2},aiHandArr:[card('桃')]},steps:[{op:'check',waitMs:3000},reload],check:s=>s.ai.hp===3&&s.turn==='player'&&s.aiHandArr.length===0&&s.deck.length===14&&s.hand.length===5},
 {id:'sha-once',initial:{...base(),hand:[card('杀'),card('杀')]},steps:[click('杀'),click('出 牌',{waitMs:1200}),reload],check:(s,run)=>s.shaUsed&&s.ai.hp===3&&s.hand.length===1&&run.final.controls.filter(c=>c.name==='杀').every(c=>c.disabled)}
]
const results=[]
for(const c of cases.filter(c=>!process.env.QA_CASES||process.env.QA_CASES.split(',').includes(c.id))){
 const spec=structuredClone(compiled.spec);spec.children.find(n=>n.type==='sandbox').props.initial={type:'literal',value:c.initial}
 const evidence=await runDebugBrowser(spec,{steps:c.steps,scenarios:['normal'],viewports:[432],size:'full',captureSteps:true,artifactDir:dir+'/'+c.id})
 const run=evidence.runs?.[0],state=run&&game(run.final)
 const pass=!!state&&c.check(state,run)&&run.actions.length===c.steps.length&&run.actions.every(a=>a.ok&&a.assertion?.passed!==false&&a.restored!==false)&&!run.pageErrors.length&&!run.final.errors.length
 const row={id:c.id,pass,fixture:true,state,layout:run?.final.layout?.issues,actions:run?.actions.map(a=>({step:a.step,ok:a.ok,restored:a.restored,error:a.error,assertion:a.assertion})),reason:evidence.reason}
 await writeFile(dir+'/'+c.id+'/evidence.json',JSON.stringify({fixture:c.initial,evidence},null,2));results.push(row)
 await writeFile(dir+'/checks.json',JSON.stringify({sourceId:id,scope:'Independent behavior QA, seeded state fixtures via sandbox.initial; no game code changes',results},null,2))
 console.log(label,c.id,pass?'PASS':'FAIL',JSON.stringify({hp:state?.player?.hp,ai:state?.ai?.hp,turn:state?.turn,over:state?.over,deck:state?.deck?.length,hand:state?.hand?.length}))
}
