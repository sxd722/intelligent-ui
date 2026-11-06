import {CASES,compile,legacyCheck,transportFor} from './engine-v3.mjs'
for(const c of CASES){
 const ui=c.static?'<state id="color" type="string" initial="蓝"/><button label="切换颜色" onPress="toggle"/><text>{state.color}</text><action id="toggle"><set target="color" value={state.color=="蓝"?"红":"蓝"}/></action>':c.write?'<button label="暂停" onPress="pause"/><text>{bindings.feed.value.items[0]?.title ?? "待命"}</text>':`<input label="筛选" value={state.query} onChange="filter"/><collection label="候选" items={derived.rows} onSelect="select"/><text>{state.selected.title}</text><text>{state.selected.summary}</text><button label="刷新" onPress="refresh"/>${c.detail?'<button label="查看详情" onPress="detail" disabled={!state.selected.entityId}/><text>{bindings.detail.value.items[0]?.body}</text><button label="返回" onPress="back"/>':''}${c.compare?'<button label="加入比较" onPress="compare" disabled={!state.selected.viewKey}/><each items={state.chosen} as="item" itemKey={item.viewKey}><text>{item.title} {item.summary}</text></each>':''}`
 const r=compile(c,'A2S','<card>'+ui+'</card>'),result=r.complete?await legacyCheck(c,'A2S',c.map,r.spec,{transportFor}):null
 console.log(JSON.stringify({case:c.id,compiled:r.complete,passed:result?.passed,errors:result?.checks.filter(c=>!c.passed)||r.diagnostics}))
 if(!result?.passed)process.exitCode=1
}
