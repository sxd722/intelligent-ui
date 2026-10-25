// Resource allocation exercises the same protocol issues without game rules.
export const RESOURCE_CARD = `<intro>本次资源分配。</intro><card schemaVersion="1" theme="soft" palette="a">
<state id="capacity" type="number" initial={5}/>
<state id="available" type="number" initial={5}/>
<state id="entries" type="array" initial={[]}/>
<action id="replenish"><set target="capacity" value={min(10,state.capacity+1)}/><set target="available" value={state.capacity}/><append target="entries" value={{id:len(state.entries)+1,text:"补充完成"}}/></action>
<region id="head" role="summary"><title id="title">资源分配</title><progress id="level" value={state.available/state.capacity} label={"可用 " + state.available + "/" + state.capacity}/></region>
<region id="history" role="content" priority="supporting" overflow="scroll" label="记录"><each id="logs" items={state.entries} itemKey={item.id}><text id="entry">{item.text}</text></each></region>
<region id="footer" role="actions"><button id="replenishBtn" onPress="replenish">补充资源</button></region>
</card><outro>操作记录保留在当前会话。</outro>`
export const BROKEN_RESOURCE_CARD = RESOURCE_CARD
  // Presentation enums now normalize to defaults; keep a real value-type error
  // so recovery still proves independent diagnostics survive malformed syntax.
  .replace('value={state.available/state.capacity}','value="not a number"')
  .replace('<append target="entries" value={{id:len(state.entries)+1,text:"补充完成"}}/>','<set target="entries" value={state.entries.concat([{id:1,text:"补充完成"}])}/>')
  .replace('role="content" priority="supporting"','role="supporting"')
  .replace('label={"可用 " + state.available + "/" + state.capacity}','label="可用 {state.available}/{state.capacity}"')
  .replace('<region id="footer"','</if><region id="footer"')
