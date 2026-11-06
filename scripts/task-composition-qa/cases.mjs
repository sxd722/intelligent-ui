export const ROOT='artifacts/task-composition-qa/20261103',DEST='dist/task-composition-qa'
export const envelope=items=>({items,source:'可控工具响应',fetchedAt:'2026-11-03T02:00:00Z',truncated:false})
export const cases=[
 {id:'feed',title:'跨来源内容',tool:'opencli.bilibili.search',input:{query:'尊界'},rows:[{bvid:'v1',title:'车主体验',author:'甲',play:100,url:'https://www.bilibili.com/video/v1'},{bvid:'v2',title:'技术说明',play:200,url:'https://www.bilibili.com/video/v2'}],secondary:{tool:'opencli.xiaohongshu.search',input:{query:'尊界'},rows:[{id:'x1',title:'车主体验',likes:12,url:'https://www.xiaohongshu.com/explore/x1'},{id:'x2',title:'出行记录',likes:null,url:'https://www.xiaohongshu.com/explore/x2'}]}},
 {id:'trip',title:'地点周边与天气',tool:'opencli.ctrip.search',input:{query:'杭州亲子'},rows:[{id:'p1',name:'湖畔公园',lat:30.15,lon:120.20,coordSystem:'WGS84',score:4.6},{id:'p2',name:'探索馆',lat:30.16,lon:120.22,coordSystem:'WGS84',score:4.8}],secondary:{tool:'opencli.dianping.search',input:{keyword:'',city:'杭州'},rows:[]}},
 {id:'movie',title:'电影与解读资料',tool:'opencli.douban.top250',input:{limit:3},rows:[{id:'m1',title:'星际穿越',rating:9.4,year:2014},{id:'m2',title:'千与千寻',rating:9.3,year:2001}],secondary:{tool:'opencli.bilibili.search',input:{query:''},rows:[]}}
]
const initial='initial={{items:[],source:"",fetchedAt:"",truncated:false}}'
export const sandboxSource=`export default function App({data,bridge}) {
 const v=data.view; const rows=v.items.slice(0,4);
 return <div style={{color:'var(--cs-ink)',height:'100%',padding:8}}>
 <svg viewBox="0 0 320 130" width="100%" height={130} role="img" aria-label="实体探索舞台">
 {rows.map((item,i)=><g key={item.id} role="button" tabIndex={0} aria-label={'探索 '+item.title} onClick={()=>bridge.call('pick',{id:item.id,item})} onKeyDown={e=>{if(e.key==='Enter')bridge.call('pick',{id:item.id,item})}}>
 <circle cx={45+i*76} cy={55} r={v.focus?.id===item.id?29:22} fill={v.focus?.id===item.id?'var(--cs-accent)':'#839fa4'} opacity={0.8}/><text x={45+i*76} y={60} fontSize={18} textAnchor="middle" fill="#fff">{i+1}</text><text x={45+i*76} y={105} fontSize={12} textAnchor="middle" fill="currentColor">{item.title.slice(0,5)}</text></g>)}
 </svg><div aria-label="共享焦点">{v.focus?v.focus.title:'请选择对象'}</div><div>{v.observations.map(o=>o.title+' '+o.summary).join(' · ')}</div><div aria-label="关联结果">{v.related.map(i=>i.title).join(' · ')}</div>
 <div>{v.issues.map(i=>i.message).join(' · ')}</div></div>}
`
export function source(c,mode){const supporting=JSON.stringify(c.secondary.input).replace('""','state.query'),invoke=c.id==='feed'?'':`<invoke binding="support" when={next.query!=""} input={${JSON.stringify(c.secondary.input).replace('""','next.query')}}/>`
 return `<card schemaVersion="1" design="business" actionMode="snapshot">
 <state id="selected" type="string" initial=""/><state id="query" type="string" initial=""/><state id="day" type="string" initial="2026-11-04"/>
 <binding id="main" tool="${c.tool}" input={${JSON.stringify(c.input)}} ${initial} load="visible"/>
 <binding id="support" tool="${c.secondary.tool}" input={${supporting}} ${initial} load="${c.id==='feed'?'visible':'manual'}"/>
 ${c.id==='trip'?`<binding id="weather" tool="opencli.wttr.forecast" input={{location:"Hangzhou",days:3}} ${initial} load="visible"/>`:''}
 <derive id="view" value={compose({main:"main",support:"support"${c.id==='trip'?',weather:"weather"':''}},{primary:"main",selectedId:state.selected,date:state.day})}/>
 ${mode==='native'?`<task-board id="board" label="${c.title}" view={derived.view} onSelect="pick" onRefresh="refresh"${c.id==='trip'?' onDateChange="date"':''}/>`:`<title>${c.title}</title><sandbox id="stage" brief="共享任务数据的实体探索" height={220} input={{view:derived.view}} actions={{pick:"pick"}} source={${JSON.stringify(sandboxSource)}}/><row><button disabled={derived.view.items.length==0} onPress="first">选择第一项</button><button disabled={derived.view.items.length<2} onPress="second">选择第二项</button></row>`}
 ${c.id==='trip'&&mode!=='native'?'<segmented label="出游日期" value={state.day} options={["2026-11-04","2026-11-05"]} onChange="date"/>':''}
 <action id="pick"><set target="selected" value={event.id}/><set target="query" value={event.item.title}/>${invoke}</action>
 <action id="first"><set target="selected" value={derived.view.items[0]?.id ?? ""}/><set target="query" value={derived.view.items[0]?.title ?? ""}/>${invoke}</action>
 <action id="second"><set target="selected" value={derived.view.items[1]?.id ?? ""}/><set target="query" value={derived.view.items[1]?.title ?? ""}/>${invoke}</action>
 <action id="date"><set target="day" value={event.value}/></action>
 <action id="refresh"><invoke binding="support"/></action>
 </card>`}

