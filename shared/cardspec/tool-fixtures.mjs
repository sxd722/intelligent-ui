export const TOOL_DEMO=`<card schemaVersion="1" actionMode="snapshot" theme="soft" palette="b">
<binding id="feed" tool="autocli.hackernews.top" input={{limit:4}} initial={{items:[],source:"Hacker News",fetchedAt:""}} load="visible" refresh={60}/>
<state id="note" type="string" initial=""/>
<state id="selected" type="string" initial=""/>
<derive id="article" value={find(bindings.feed.value.items,item.id==state.selected) ?? bindings.feed.value.items[0]}/>
<binding id="explain" tool="glm.generate" input={{prompt:"用简明中文解释这条资讯的意义。只根据提供的数据，不要假装读过链接全文。",context:{article:derived.article ?? null}}}/>
<title>开发者灵感台</title><caption>真实资讯 · 点击标题选择 · 深入探索</caption>
<region id="news" role="content" overflow="scroll" label="实时资讯">
<each id="rows" items={bindings.feed.value.items} itemKey={item.id}><pressable id="item" onPress="select" args={{id:item.id}} selected={state.selected==item.id}><strong>{item.title}</strong><caption>{item.author+" · "+item.scoreLabel+" "+item.score}</caption></pressable></each>
<if test={len(bindings.feed.value.items)==0}><text>正在等待真实数据；可点击刷新重试。</text></if>
</region>
<slot id="detail" label="资讯解释"><caption>选择资讯后，点击解释或生成下一页。</caption></slot>
<input id="noteInput" label="我的笔记" value={state.note} onChange="note"/>
<row><button onPress="refresh">刷新资讯</button><button onPress="explain" disabled={len(bindings.feed.value.items)==0}>解释一下</button><button onPress="next" disabled={len(bindings.feed.value.items)==0}>深入探索</button></row>
<action id="note"><set target="note" value={event.value}/></action>
<action id="select"><set target="selected" value={args.id}/></action>
<action id="refresh"><invoke binding="feed"/></action>
<action id="explain"><invoke binding="explain" target="slot:detail"/></action>
<action id="next"><invoke binding="explain" target="page"/></action>
</card>`
export const TOOL_PAGE=`<card schemaVersion="1" actionMode="snapshot" theme="soft" palette="b"><state id="note" type="string" initial=""/><binding id="more" tool="glm.generate" input={{prompt:"继续解释下一页",context:{note:state.note}}}/><title>深入了解</title><text>这是生成的下一页。</text><input label="本页笔记" value={state.note} onChange="note"/><button onPress="next">继续下一页</button><action id="note"><set target="note" value={event.value}/></action><action id="next"><invoke binding="more" target="page"/></action></card>`
export const TOOL_SLOT=`<card schemaVersion="1" actionMode="snapshot"><state id="likes" type="number" initial={0}/><text>这条资讯的解释已生成。</text><button onPress="like">有帮助 {state.likes}</button><action id="like"><increment target="likes"/></action></card>`
