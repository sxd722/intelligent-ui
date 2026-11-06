const cases={
 toolViewFeed:{tool:'opencli.google.news',input:{keyword:'测试'},rows:[{title:'储能研究取得新进展',source:'研究通讯',date:'2026-10-26'},{title:'城市绿道开放体验',source:'城市日报'},{title:'新的公共图书馆',source:'城市日报'},{title:'河流生态调查',source:'研究通讯'}]},
 toolViewMedia:{tool:'opencli.douban.top250',rows:[{id:'mock1',title:'星际之旅',rating:8.6,year:2024},{id:'mock2',title:'山间来信',rating:8.1,year:2023},{id:'mock3',title:'雨后漫游',rating:null,year:2024},{id:'mock4',title:'冬日来客',rating:7.9,year:2023}]},
 toolViewDetail:{tool:'opencli.wikipedia.summary',input:{title:'测试'},rows:[{title:'潮汐',extract:'引力与天体运动共同塑造海水涨落。选择查看解释与来源。'}]},
 toolViewRoute:{tool:'opencli.12306.trains',input:{from:'杭州东',to:'上海虹桥',date:'2026-10-26'},rows:[{code:'G测试1',from_station:'杭州东',to_station:'上海虹桥',start_time:'14:00',arrive_time:'15:02',second_seat:'有'},{code:'G测试2',from_station:'杭州东',to_station:'上海虹桥',start_time:'15:00',arrive_time:'16:11',second_seat:'无'}]},
 toolViewPlaces:{tool:'opencli.dianping.search',input:{keyword:'测试'},rows:[{name:'湖畔咖啡',rating:4.5,address:'测试路1号',price:42},{name:'林间餐厅',rating:4.8,address:'测试路2号',price:58}]},
 toolViewWeather:{tool:'opencli.wttr.current',input:{location:'Hangzhou'},rows:[{location:'杭州',tempC:23,weather:'多云',humidity:60}]},
 toolViewMetrics:{tool:'opencli.dongchedi.score',input:{series_id:'test'},rows:[{dimension:'舒适性',score:4.2},{dimension:'空间',score:4.5},{dimension:'操控',score:3.9}]},
 toolViewReceipt:{tool:'opencli.spotify.pause',rows:[{status:'paused',message:'测试暂停回执'}]},
 toolViewDrift:{tool:'opencli.douban.top250',rows:[{renamed_title:'字段漂移测试'}]},
 toolViewEmpty:{tool:'opencli.douban.top250',rows:[]}
}
export const TOOL_VIEW_FIXTURES=Object.fromEntries(Object.entries(cases).map(([key,c])=>{
 const value={items:c.rows.map((r,i)=>({...r,rowKey:`fixture-${i}`})),source:'可控测试数据（非实时）',fetchedAt:'2026-10-26T00:00:00Z',truncated:false}
 return [key,{source:`<card><state id="choice" type="string" initial=""/><binding id="demo" tool="${c.tool}" input={${JSON.stringify(c.input||{})}} initial={${JSON.stringify(value)}} load="manual"/><tool-view binding="demo" label="${key.replace('toolView','')}" onSelect="pick"/><caption>{state.choice}</caption><action id="pick"><set target="choice" value={event.item.title ?? event.item.name ?? event.item.dimension ?? event.item.code ?? event.item.location ?? event.item.status ?? "已选择"}/></action></card>`,prefetched:[{id:'D1',tool:c.tool,input:c.input||{},value,updatedAt:value.fetchedAt}],transport:async()=>({kind:'json',value})}]
}))
