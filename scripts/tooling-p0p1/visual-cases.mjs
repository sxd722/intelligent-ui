export const cases=[
 {id:'places',tool:'opencli.dianping.search',input:{keyword:'亲子',city:'杭州'},rows:[{shop_id:'p1',name:'湖畔自然课堂',district:'萧山区',cuisine:'自然观察',rating:4.7,lat:30.15,lon:120.20,coordSystem:'WGS84'},{shop_id:'p2',name:'森林探索馆',district:'滨江区',rating:4.5,lat:30.16,lon:120.21,coordSystem:'WGS84'},{shop_id:'p3',name:'科学实验室',district:'萧山区',rating:null}]},
 {id:'trains',tool:'opencli.12306.trains',input:{from:'杭州东',to:'上海南',date:'2026-11-06'},rows:[{code:'G100',from_station:'杭州东',to_station:'上海南',start_time:'14:30',arrive_time:'15:28',duration:'00:58',second_seat:'有'},{code:'G102',from_station:'杭州东',to_station:'上海南',start_time:'15:10',arrive_time:'16:12',duration:'01:02',second_seat:'无'}]},
 {id:'movies',tool:'opencli.douban.top250',input:{limit:3},rows:[{id:'m1',title:'星际穿越',rating:9.4},{id:'m2',title:'千与千寻',rating:9.3},{id:'m3',title:'飞屋环游记',rating:9.1}]},
 {id:'weather',tool:'opencli.wttr.forecast',input:{location:'Hangzhou',days:3},rows:[{date:'2026-11-03',description:'阴',minTempC:0,maxTempC:15},{date:'2026-11-04',description:'晴',minTempC:9,maxTempC:21},{date:'2026-11-05',description:'雨',minTempC:10,maxTempC:18}]},
 {id:'scores',tool:'opencli.dongchedi.score',input:{series_id:100},rows:[{dimension:'空间',score:4.7,same_level_avg:4.2},{dimension:'舒适性',score:4.3,same_level_avg:4.4},{dimension:'操控',score:4.1,same_level_avg:4.3},{dimension:'外观',score:4.5,same_level_avg:4.1},{dimension:'配置',score:null,same_level_avg:4.2}]}
]
export const families=['pearl','atlas','field','persona'],formats=['2x2','2x4','4x4','miniapp']
