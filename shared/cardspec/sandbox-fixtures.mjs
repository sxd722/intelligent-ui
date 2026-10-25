// Both presentations implement the same local simulator. No external facts.
export const SANDBOX_NATIVE=`<title>储能调度实验</title>
<text tone="muted">示例模型：每步消耗 10，充能增加 15。调整策略并观察余额。</text>
<state id="energy" type="number" initial={60}/><state id="steps" type="number" initial={0}/>
<stat label="剩余能量" value={state.energy}/><stat label="完成步数" value={state.steps}/>
<row><button onPress="advance" disabled={state.energy&lt;10}>推进一步</button><button onPress="charge">充能</button><button onPress="reset">重置</button></row>`
const actions=`<action id="advance"><set target="energy" value={max(0,state.energy-10)}/><increment target="steps"/></action><action id="charge"><set target="energy" value={min(100,state.energy+15)}/></action><action id="reset"><set target="energy" value={60}/><set target="steps" value={0}/></action>`
// State declarations stay at the root, fallback UI stays inside the optional surface.
const states=SANDBOX_NATIVE.match(/<state[^>]+\/>/g).join('')
export const SANDBOX_FIXTURE=`<card theme="soft">${states}<sandbox id="energyView" label="储能实验视图" height={300} initial={{energy:60,steps:0}} input={{cost:10,charge:15}} brief="QA_SANDBOX 储能调度模拟器：用 SVG 能量仓展示 state.energy；推进消耗 data.cost 并将 steps 加一，低于 cost 时禁用；充能加 data.charge，上限100；重置到energy60 steps0。显示余额与步数。全部用state/setState，提供推进一步、充能、重置按钮。紧凑蓝绿色仪表盘，不使用外部资源。">${SANDBOX_NATIVE.replace(/<state[^>]+\/>/g,'')}</sandbox>${actions}</card>`
export const SANDBOX_PURE=`<card theme="soft">${SANDBOX_NATIVE}${actions}</card>`
export const SANDBOX_REACT=`export default function App({data,state,setState}){
 const e=state.energy,s=state.steps;
 return <section className="p-4 bg-slate-900 text-white rounded-2xl"><div className="flex justify-between"><h2 className="text-lg font-bold">储能调度实验</h2><span className="text-emerald-300">第 {s} 步</span></div><svg viewBox="0 0 340 115" height="115" role="img" aria-label="储能水平"><rect x="10" y="20" width="320" height="70" rx="18" fill="#334155"/><rect x="10" y="20" width={3.2*e} height="70" rx="18" fill="#34d399"/><text x="170" y="64" textAnchor="middle" fill="#ffffff" fontSize="24">{e} / 100</text></svg><p className="text-sm text-slate-300 mb-3">模拟数据 · 每步 −{data.cost}，充能 +{data.charge}</p><div className="flex gap-2"><button className="px-3 py-2 bg-teal-700 rounded-lg disabled:opacity-40" disabled={e<data.cost} onClick={()=>setState(v=>({...v,energy:v.energy-data.cost,steps:v.steps+1}))}>推进一步</button><button className="px-3 py-2 bg-slate-700 rounded-lg" onClick={()=>setState(v=>({...v,energy:Math.min(100,v.energy+data.charge)}))}>充能</button><button className="px-3 py-2 bg-slate-700 rounded-lg" onClick={()=>setState({energy:60,steps:0})}>重置</button></div></section>
}`
