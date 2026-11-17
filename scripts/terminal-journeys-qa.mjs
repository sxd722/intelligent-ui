import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
import {terminalJourneyCoverage} from '../server/cardspec/terminal-journeys.mjs'
import {assertSnapshot} from '../shared/cardspec/debug-assertions.mjs'
const root='artifacts/terminal-journeys-qa';await mkdir(root,{recursive:true})
const click=(name,extra={})=>({op:'click',name,...extra})
const terminal=(outcome,owner)=>({terminal:{outcome,...(owner?{owner}:{}),key:'ending',value:outcome}})
const native=`<card theme="dark" design="atlas" actionMode="snapshot"><state id="n" type="number" initial={0}/><state id="hp" type="number" initial={3}/><state id="ending" type="string" initial=""/><title>远航试验</title><text>累积 20 次推进抵达港口；三次冒险失败。用于验证完整路径，不是随机策略证明。</text><stat label="航程" value={state.n}/><stat label="耐久" value={state.hp}/><text>{state.ending}</text><button onPress="advance" disabled={state.ending!=""}>推进</button><button onPress="risk" disabled={state.ending!=""}>冒险</button><action id="advance"><set target="n" value={state.n+1}/><set target="ending" value={state.n+1>=20?"win":""}/></action><action id="risk"><set target="hp" value={state.hp-1}/><set target="ending" value={state.hp-1<=0?"loss":""}/></action></card>`
const nativeSteps=[click('推进',{path:'win',repeat:20,expect:terminal('win')}),click('冒险',{path:'loss',repeat:3,expect:terminal('loss')}),click('推进',{path:'restore',repeat:2,expect:{state:{n:2}}}),{op:'reload',path:'restore'},click('推进',{path:'restore',expect:{state:{n:3}}})]
const web=`<card theme="dark"><sandbox id="sim" brief="确定性状态机验收" height={280} initial={{n:0,hp:3,ending:""}} source={\`export default function App({state,setState}){return <section style={{padding:20,color:'#fff',background:'#192536'}}><h2>信号实验室</h2><p>进度 {state.n} / 20 · 能量 {state.hp}</p><p>{state.ending}</p><button disabled={!!state.ending} onClick={()=>setState(s=>({...s,n:s.n+1,ending:s.n+1>=20?'win':''}))}>推进</button><button disabled={!!state.ending} onClick={()=>setState(s=>({...s,hp:s.hp-1,ending:s.hp-1<=0?'loss':''}))}>冒险</button></section>}\`}/></card>`
const webSteps=nativeSteps.map(s=>({...s,expect:s.expect?.terminal?terminal(s.expect.terminal.outcome,'sim'):s.expect?{changed:true}:undefined}))
async function run(id,source,steps,context={}){const result=compileCard(source,{final:true,context:{renderMode:'native',cardSize:'full',...context}});await validateRichContent(result);if(!result.complete)throw Error(id+JSON.stringify(result.diagnostics));await writeFile(`${root}/${id}.source.txt`,source);const start=Date.now();const r=await runDebugBrowser(result.spec,{steps,scenarios:['normal'],viewports:[432],size:'full',signal:AbortSignal.timeout(id==='ashen-original'?240000:90000),artifactDir:`${root}/${id}`});const coverage=terminalJourneyCoverage('游戏',r);await writeFile(`${root}/${id}.trace.json`,JSON.stringify(r,null,2));const row={id,elapsedMs:Date.now()-start,status:r.status,coverage,failures:r.runs.flatMap(x=>x.actions.filter(a=>!a.ok||a.assertion?.passed===false).map(a=>({path:x.path,step:a.step,error:a.error,failures:a.assertion?.failures}))),screenshots:r.runs.map(x=>`${id}/${x.screenshot}`)};console.log(JSON.stringify(row));return row}
const rows=process.argv.includes('--ashen-only')?JSON.parse(await readFile(root+'/results.json','utf8')).rows.filter(r=>r.id!=='ashen-original'):[]
if(!process.argv.includes('--ashen-only')){
rows.push(await run('native-game',native,nativeSteps))
rows.push(await run('web-game',web,webSteps,{renderMode:'web'}))
rows.push(await run('strict-game',web,webSteps,{renderMode:'hybrid'}))
// Same UI contract, a terminal overwritten in the transaction must fail.
rows.push(await run('overwritten-terminal',native.replace('state.n+1>=20?"win":""','state.n+1>=20?"loss":""'),nativeSteps))
}
// Original production program: no edits or injected saves, only accessible UI.
const original=await readFile('artifacts/compact-workspace-qa/original.source.txt','utf8')
const cards={labor:'♟ 旧街谋生 人物',reason:'◇ 清醒思辨 能力',passion:'✧ 灼热灵感 能力',tower:'⌂ 旧钟楼 地点',fragment:'▤ 灰烬残页 文献',sigil:'☷ 灰烬密语 知识',recruit:'♙ 夜行抄写员 人物',follower:'♜ 灰衣信徒 成员',relic:'♧ 无声铜铃 器物'}
const steps=[click('Ⅱ 暂停')]
function action(mode,keys,ticks){for(const k of keys)steps.push(click(cards[k]),click('投入'+mode));steps.push(click('启动'+mode),click('单步 ›',{repeat:ticks}))}
action('工作',['labor'],5);action('工作',['labor'],5);action('探索',['tower'],8);action('研究',['reason','fragment','passion'],7);action('交谈',['passion','sigil'],6);action('交谈',['passion','sigil','recruit'],6);action('探索',['tower','follower'],8);action('仪式',['sigil','relic','follower'],12)
steps.at(-1).expect=terminal('win','game')
rows.push(await run('ashen-original',original,steps,{renderMode:'web'}))
const historical=JSON.parse(await readFile('artifacts/compact-workspace-qa/play-trace.json','utf8'));const ending=historical.findLast(s=>s.componentState?.['/game']?.webSandbox?.state?.ending)
const regression=assertSnapshot(terminal('win','game'),historical[0],ending)
await writeFile(`${root}/results.json`,JSON.stringify({createdAt:new Date().toISOString(),rows,archivedTerminalOverwrite:regression,limitations:['Authored fixtures, not fresh model generations','Fixed seed, observed paths, not exhaustive reachability proof','Original game remains failed; no gameplay rules silently patched']},null,2))
