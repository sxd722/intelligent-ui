export const SANDBOX_LINKED=`<card theme="soft" actionMode="snapshot">
<state id="level" type="number" initial={30}/><state id="count" type="number" initial={0}/>
<binding id="feed" tool="autocli.hackernews.top" input={{limit:3}} initial={{items:[],source:"Hacker News",fetchedAt:""}}/>
<title>联动实验</title><slider label="强度" min={0} max={100} value={state.level} onChange="adjust"/>
<row><button onPress="reset">归零</button><button onPress="refresh">刷新数据</button></row>
<sandbox id="linked" label="动态图形" height={220} input={{level:state.level,count:state.count,status:bindings.feed.status}} actions={{adjust:"adjust",refresh:"refresh"}} brief="只画高阶SVG波形和动态能量图，读取data.level。点击波形用bridge.call adjust传value75；查询形状调用refresh；显示data.count/status。CSS keyframes自主运动。外部已经有滑杆、归零和刷新按钮，不再复制；继承透明材质。">
<stat label="强度结果" value={state.level}/><stat label="数据条数" value={state.count}/>
</sandbox>
<action id="adjust"><set target="level" value={clamp(event.value,0,100)}/></action>
<action id="reset"><set target="level" value={0}/></action>
<action id="refresh"><invoke binding="feed" onSuccess="received"/></action>
<action id="received"><set target="count" value={len(event.result.items)}/></action>
</card>`
export const LINKED_REACT=`export const styles="@keyframes ripple{from{opacity:.3;transform:scale(.9)}to{opacity:1;transform:scale(1)}}.wave{animation:ripple 1.2s ease-in-out infinite alternate;transform-origin:center}";
export default function App({data,bridge}){return <svg viewBox="0 0 340 220" height={220} style={{width:'100%',color:'var(--cs-ink)'}} aria-label="联动波形">
<defs><marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6Z" fill="var(--cs-accent)"/></marker></defs>
<g role="button" aria-label="波形设为75" tabIndex={0} onClick={()=>bridge.call('adjust',{value:75})} onKeyDown={e=>{if(e.key==='Enter')bridge.call('adjust',{value:75})}}>
<rect x={25} y={20} width={150} height={150} fill="transparent"/>
<circle className="wave" cx={100} cy={95} r={30+data.level/4} fill="var(--cs-accent)"/><text x={100} y={100} textAnchor="middle" fill="var(--cs-ink)">{data.level}</text></g>
<line x1={170} y1={95} x2={210} y2={95} stroke="var(--cs-accent)" markerEnd="url(#arrow)"/>
<g role="button" aria-label="图中查询" tabIndex={0} onClick={()=>bridge.call('refresh')} onKeyDown={e=>{if(e.key==='Enter')bridge.call('refresh')}}><rect x={230} y={65} width={90} height={60} rx={12} fill="var(--cs-field-mask)"/><text x={275} y={100} textAnchor="middle" fill="var(--cs-ink)">查询</text></g>
<text x={170} y={175} textAnchor="middle" fill="var(--cs-ink)">强度 {data.level} · 结果 {data.count} · {data.status}</text></svg>}`
