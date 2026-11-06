const initial='{items:[],source:"",fetchedAt:"",truncated:false}'
const title='<title>{data.config.title}</title>'
const weather=`<binding id="weather" tool="opencli.wttr.current" input={{location:data.config.weather}} initial={${initial}} load="visible"/>
<derive id="weather" value={bindings.weather.value?.items?.[0]??{}}/>
<caption>{data.config.city+" · "+(derived.weather.tempC==null?"天气待更新":derived.weather.tempC+"°C · "+(derived.weather.description??""))}</caption>`
const step=(op,name,expect,value)=>({op,...(name?{name}:{}),...(value!==undefined?{value}:{}),expect})
export const complexCases=[{
 id:'travel',name:'亲子城市探索',target:'苏州两天亲子游',
 prompt:'做同款：把杭州两天亲子游改为苏州两天亲子游。config.title改为苏州亲子慢游、city改苏州、weather改Suzhou、query改苏州园林、budget改600；两个dayLabels分别为园林发现、老城漫步。保持景点多选、地图、预算、两天分组、返回与恢复功能，所有地点仍来自真实携程绑定，不编造营业或费用。其余数据和代码保持原样。',
 source:`<intro>城市地点探索与两天分组草稿；联想结果包含多种地点类型，不代表景点推荐或路线优化。预算为家庭自设，非门票报价。</intro>
<card design="parchment" actionMode="snapshot">
<data id="config" value={{title:"杭州亲子慢游",city:"杭州",weather:"Hangzhou",query:"杭州西湖",budget:400}}/>
<data id="dayLabels" value={[{id:"d1",label:"湖畔探索"},{id:"d2",label:"城市漫步"}]}/>
<binding id="places" tool="opencli.ctrip.search" input={{query:data.config.query,limit:6}} initial={${initial}} load="visible"/>
<state id="view" type="string" initial="explore"/><state id="index" type="number" initial={0}/><state id="picks" type="array" initial={[]}/><state id="budget" type="number" initial={0}/>
<derive id="rows" value={bindings.places.value?.items??[]}/><derive id="current" value={derived.rows[state.index%Math.max(1,derived.rows.length)]??{}}/><derive id="chosen" value={derived.rows.filter(x=>state.picks.includes(x.rowKey??x.id))}/>
${title}${weather}
<stack space="tight"><segmented label="旅程视图" value={state.view} options={[{value:"explore",label:"探索"},{value:"map",label:"地图"},{value:"plan",label:"行程"}]} onChange="view"/>
<if test={state.view=="explore"}><caption>{"候选 "+(derived.rows.length?state.index%derived.rows.length+1:0)+" / "+derived.rows.length+" · 已选 "+derived.chosen.length}</caption>
<strong>{derived.current.name??"等待地点数据"}</strong><badge>{derived.current.displayType??"类型待核实"}</badge>
<row><button onPress="add" disabled={!derived.current.rowKey}>加入行程</button><button onPress="next" disabled={derived.rows.length==0}>下一个地点</button></row>
<caption>按原始地点类型选入；地图与行程共用同一选中集合。</caption></if>
<if test={state.view=="map"}><map label="候选地点" items={derived.rows} selectedIds={state.picks} onSelect="mapPick"/></if>
<if test={state.view=="plan"}><region id="planBody" role="content" overflow="scroll" label="行程内容"><input label="家庭预算" inputType="number" value={state.budget||data.config.budget} onChange="budget"/>
<caption>{"每日预算 ¥"+Math.round((state.budget||data.config.budget)/2)+" · 已选 "+derived.chosen.length}</caption>
<each items={derived.chosen} as="place" itemKey={place.rowKey??place.id}><row><text clamp={2}>{data.dayLabels[derived.chosen.indexOf(place)%2].label+" · "+place.name}</text><button label="移除地点" onPress="remove" args={{id:place.rowKey??place.id}}>移除</button></row></each>
<if test={derived.chosen.length==0}><text>先从探索页选择地点</text></if></region></if>
</stack><action id="view"><set target="view" value={event.value}/></action><action id="budget"><set target="budget" value={event.value}/></action>
<action id="next"><set target="index" value={(state.index+1)%Math.max(1,derived.rows.length)}/></action>
<action id="add"><set target="picks" value={state.picks.includes(derived.current.rowKey??derived.current.id)?state.picks:state.picks.concat([derived.current.rowKey??derived.current.id])}/></action>
<action id="remove"><set target="picks" value={state.picks.filter(x=>x!==args.id)}/></action>
<action id="mapPick"><set target="picks" value={state.picks.includes(event.id)?state.picks.filter(x=>x!==event.id):state.picks.concat([event.id])}/></action>
</card>`,
 steps:[step('click','加入行程',{changed:true,text:'已选 1'}),step('click','下一个地点',{changed:true}),step('click','加入行程',{changed:true,text:'已选 2'}),step('click','行程',{changed:true,state:{view:'plan'}}),step('fill','家庭预算',{changed:true,text:'每日预算 ¥350',state:{budget:700}},'700'),step('reload',null,{changed:false,text:'已选 2',state:{view:'plan',budget:700}}),step('click','移除地点',{changed:true,text:'已选 1'}),step('click','地图',{changed:true,state:{view:'map'}}),step('click','探索',{changed:true,state:{view:'explore'},text:'已选 1'})]
},{
 id:'care',name:'幼儿照护交接',target:'杭州祖辈接班',
 prompt:'做同款：照护卡改为杭州祖辈接班，config.title=祖辈接班小助手、city=杭州、weather=Hangzhou、videoQuery=幼儿 室内 亲子游戏。四个任务仍保留id meal/rest/play/pack，分别替换为：08:30 自主早餐 记录本次用餐情况；12:30 安静休息 记录实际休息开始；15:00 室内拼图 一起完成简单拼图；17:30 整理交接 留下待办给下一位照护者。保持完成进度、切换、交接备注、天气及视频绑定。时间是用户自定示例，不作健康建议。',
 source:`<intro>照护时间为家庭自定演示，不是年龄相关作息建议。视频是搜索线索，需要照护者自行判断适用性。</intro><card design="academy" actionMode="snapshot">
<data id="config" value={{title:"日常照护交接",city:"上海",weather:"Shanghai",videoQuery:"幼儿 亲子游戏"}}/>
<data id="tasks" value={[{id:"meal",time:"08:00",label:"早餐记录",note:"记录这次用餐情况"},{id:"rest",time:"12:00",label:"午间休息",note:"记录实际休息开始"},{id:"play",time:"15:00",label:"一起搭积木",note:"选择轻松亲子活动"},{id:"pack",time:"17:00",label:"交接整理",note:"把待办留给下一位"}]}/>
<binding id="videos" tool="opencli.bilibili.search" input={{query:data.config.videoQuery,limit:3}} initial={${initial}} load="visible"/>
<state id="view" type="string" initial="now"/><state id="n" type="number" initial={0}/><state id="done" type="array" initial={[]}/><state id="memo" type="string" initial=""/>
<derive id="current" value={data.tasks[state.n]}/><derive id="pending" value={data.tasks.filter(x=>!state.done.includes(x.id))}/>
${title}${weather.replace('<caption>','<if test={state.view=="ideas"}><caption>').replace('</caption>','</caption></if>')}
<stack space="tight"><segmented label="照护视图" value={state.view} options={[{value:"now",label:"当前"},{value:"handoff",label:"交接"},{value:"ideas",label:"活动"}]} onChange="view"/>
<if test={state.view=="now"}><progress label="今日完成" value={state.done.length/data.tasks.length}/><strong>{derived.current.time+" · "+derived.current.label}</strong><caption>{derived.current.note+" · "+(state.done.includes(derived.current.id)?"已完成":"待完成")}</caption><row><button onPress="toggle">完成或撤销</button><button onPress="next">下一事项</button></row></if>
<if test={state.view=="handoff"}><region id="handoffBody" role="content" overflow="scroll" label="交接内容"><text>{"尚有 "+derived.pending.length+" 项待交接"}</text><caption>{derived.pending.map(x=>x.time+" "+x.label).join(" / ")}</caption><input label="交接备注" value={state.memo} onChange="memo"/><text>{state.memo||"尚无备注"}</text></region></if>
<if test={state.view=="ideas"}><caption>{derived.weather.precipMm==null?"降水信息未知，活动地点由家长选择":derived.weather.precipMm>0?"当前有降水，可先查看室内活动":"当前未报告降水；结合现场情况安排活动"}</caption><each items={(bindings.videos.value?.items??[]).slice(0,2)} as="v" itemKey={v.rowKey}><text clamp={2}>{v.title}</text><if test={!!v.url}><link url={v.url}>查看活动视频</link></if></each></if>
</stack><action id="view"><set target="view" value={event.value}/></action><action id="memo"><set target="memo" value={event.value}/></action><action id="next"><set target="n" value={(state.n+1)%data.tasks.length}/></action><action id="toggle"><set target="done" value={state.done.includes(derived.current.id)?state.done.filter(x=>x!==derived.current.id):state.done.concat([derived.current.id])}/></action>
</card>`,
 steps:[step('click','完成或撤销',{changed:true,text:'25%',state:{done:['meal']}}),step('click','下一事项',{changed:true,state:{n:1}}),step('click','完成或撤销',{changed:true,text:'50%',state:{done:['meal','rest']}}),step('click','交接',{changed:true,text:'尚有 2 项待交接'}),step('fill','交接备注',{changed:true,state:{memo:'水杯放在背包侧袋'}},'水杯放在背包侧袋'),step('reload',null,{changed:false,text:'水杯放在背包侧袋',state:{done:['meal','rest'],view:'handoff'}}),step('click','活动',{changed:true,state:{view:'ideas'}}),step('click','当前',{changed:true,text:'50%'}),step('click','完成或撤销',{changed:true,text:'25%',state:{done:['meal']}})]
},{
 id:'rail',name:'带娃短途铁路',target:'杭州东到南京南',
 prompt:'做同款：标题改为南京短途出发，config.to改南京南，其余date=2026-10-31、from=杭州东保持，weather仍为杭州出发地。保持真实12306取数、二等座过滤、候选切换、固定车次、详情返回与刷新恢复。不能虚构车次或票额，不能把bookable当有票。',
 source:`<intro>车次与余票来自12306查询；固定只保存在卡片中，不自动下单。开放官方入口不代表完成购票。</intro><card design="business" actionMode="snapshot">
<data id="config" value={{title:"上海短途出发",city:"杭州",weather:"Hangzhou",from:"杭州东",to:"上海虹桥",date:"2026-10-31"}}/>
<binding id="trains" tool="opencli.12306.trains" input={{from:data.config.from,to:data.config.to,date:data.config.date,departureAfter:"12:00",departureBefore:"18:00",limit:8}} initial={${initial}} load="visible"/>
<state id="view" type="string" initial="choose"/><state id="n" type="number" initial={0}/><state id="only" type="boolean" initial={false}/><state id="pinned" type="string" initial=""/>
<derive id="all" value={bindings.trains.value?.items??[]}/><derive id="rows" value={derived.all.filter(x=>!state.only||(x.second_seat!=null&amp;&amp;x.second_seat!="无"&amp;&amp;x.second_seat!=""&amp;&amp;x.second_seat!="0"))}/>
<derive id="current" value={derived.rows[state.n%Math.max(1,derived.rows.length)]??{}}/><derive id="fixed" value={derived.all.find(x=>x.rowKey==state.pinned)??{}}/>
${title}<caption>{data.config.date+" · "+data.config.from+" → "+data.config.to}</caption>
<stack space="tight"><segmented label="车次视图" value={state.view} options={[{value:"choose",label:"选车"},{value:"fixed",label:"固定车次"}]} onChange="view"/>
<if test={state.view=="choose"}><region id="railBody" role="content" overflow="scroll" label="候选车次"><toggle label="仅看二等座有票" checked={state.only} onChange="filter"/><caption>{"候选 "+derived.rows.length+" 班 · "+(derived.rows.length?state.n%derived.rows.length+1:0)}</caption><strong>{derived.current.code??"暂无匹配车次"}</strong><text>{(derived.current.start_time??"--:--")+" → "+(derived.current.arrive_time??"--:--")+" · "+(derived.current.duration??"时长待确认")}</text><badge>{"二等座："+(derived.current.second_seat??"未知")}</badge><row><button onPress="next" disabled={derived.rows.length==0}>下一班</button><button onPress="pin" disabled={!derived.current.rowKey}>固定当前车次</button></row><if test={state.pinned!=""}><caption>已固定，切换到固定车次查看</caption></if></region></if>
<if test={state.view=="fixed"}><if test={state.pinned==""}><text>请先选择并固定车次</text></if><if test={state.pinned!=""}><strong>{derived.fixed.code??"该车次已不在最新结果中"}</strong><text>{(derived.fixed.from_station??data.config.from)+" → "+(derived.fixed.to_station??data.config.to)}</text><text>{(derived.fixed.start_time??"--:--")+" / 二等座 "+(derived.fixed.second_seat??"未知")}</text><link url="https://www.12306.cn/">前往12306购票</link><button onPress="clear">取消固定</button></if></if>
</stack><action id="view"><set target="view" value={event.value}/></action><action id="filter"><set target="only" value={event.checked}/><set target="n" value={0}/></action><action id="next"><set target="n" value={(state.n+1)%Math.max(1,derived.rows.length)}/></action><action id="pin"><set target="pinned" value={derived.current.rowKey}/></action><action id="clear"><set target="pinned" value=""/></action>
</card>`.replaceAll('&amp;','&'),
 steps:[step('click','下一班',{changed:true,state:{n:1}}),step('click','固定当前车次',{changed:true,text:'已固定'}),step('click','固定车次',{changed:true,state:{view:'fixed'}}),step('reload',null,{changed:false,state:{view:'fixed'}}),step('click','取消固定',{changed:true,state:{pinned:''},text:'请先选择并固定车次'}),step('click','选车',{changed:true,state:{view:'choose'}}),step('click','仅看二等座有票',{changed:true,state:{only:true,n:0},text:'候选 0 班'}),step('click','仅看二等座有票',{changed:true,state:{only:false}})]
}]
