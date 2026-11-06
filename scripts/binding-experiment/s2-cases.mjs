import {DISCOVERY_CASES} from '../../server/tools/discovery-cases.mjs'
import {CASES as seed} from './cases.mjs'
import {slotContract} from '../../shared/cardspec/tool-slots.mjs'
const fields=(...entries)=>entries.map(([path,label,type='scalar',unit=''])=>({key:path,path,label,type,unit}))
const profile=(tool,input,rows,title,entity,entries)=>({tool,input,rows,contract:entries?{title,entity,fields:fields(...entries)}:slotContract(tool)})
const from=id=>{const c=seed.find(c=>c.id===id);return {...profile(c.tool,c.input,c.rows),detail:c.detail?{tool:c.detail.tool,param:c.detail.param,fixed:c.detail.fixed||{},rows:c.details(c.rows[0][c.map.id]).items}:undefined}}
const movie=from('movies'),weather=from('weather'),train=from('trains'),places=from('family'),video=from('videos'),pause=from('write')
train.input={...train.input,to:'上海南'};train.detail={...train.detail,fixed:{...train.detail.fixed,to:'上海南'}};train.rows=train.rows.map(r=>({...r,from_station:'杭州东',to_station:'上海南'}))
const current=profile('opencli.wttr.current',{location:'Hangzhou'},[{location:'杭州',description:'小雨',tempC:16,feelsLikeC:14}])
const car=profile('opencli.dongchedi.search',{keyword:'尊界'},[{series_id:'car-1',name:'尊界测试车型',brand:'示例品牌',official_price:'60–80万元'},{series_id:'car-2',name:'对照测试车型',brand:'示例品牌',official_price:'40–60万元'}],'name','series_id',[['brand','品牌'],['official_price','指导价']]);car.detail={tool:'opencli.dongchedi.koubei',param:'series_id',fixed:{limit:3},rows:[{user:'体验者A',score:4.2,content:'座椅舒适，车机偶尔迟缓。'},{user:'体验者B',score:3.8,content:'空间够用，价格仍偏高。'}]}
const social=profile('opencli.weibo.search',{keyword:'尊界'},[{id:'p1',title:'车主体验：空间满意',author:'测试甲',time:'2026-11-01'},{id:'p2',title:'讨论：希望改进车机',author:'测试乙',time:'2026-11-02'}],'title','id',[['author','作者'],['time','发布时间']])
const shop=profile('opencli.jd.search',{query:'降噪耳机'},[{sku:'sku1',title:'轻音耳机',price:399,shop:'测试自营店'},{sku:'sku2',title:'静听耳机',price:499,shop:'测试旗舰店'},{sku:'sku3',title:'专业耳机',price:899,shop:'测试店'}],'title','sku',[['price','价格','number','元'],['shop','店铺']]);shop.detail={tool:'opencli.jd.reviews',param:'sku',fixed:{limit:3},rows:[{user:'购买者A',content:'通话不错，但风噪明显。',date:'2026-10-31'},{user:'购买者B',content:'佩戴舒适，电池一般。',date:'2026-11-01'}]}
const podcast=profile('opencli.apple-podcasts.search',{query:'天文学'},[{id:'pod1',title:'星空漫步',author:'测试科学台',episodes:20,genre:'科学'},{id:'pod2',title:'宇宙来信',author:'测试科普台',episodes:12,genre:'天文'}],'title','id',[['author','制作人'],['episodes','节目数','number','期'],['genre','分类']])
const book=profile('opencli.douban.book-hot',{limit:3},[{title:'阅读宇宙',author:'测试作者A',rating:8.3,year:'2026'},{title:'城市散步',author:'测试作者B',rating:8.1,year:'2025'}],'title',null,[['author','作者'],['rating','评分','number'],['year','年份']])
const notes=profile('opencli.weread.notebooks',{},[{bookId:'book-1',title:'时间的纹理',author:'测试作者',noteCount:2},{bookId:'book-2',title:'城市观察',author:'测试作者二',noteCount:1}],'title','bookId',[['author','作者'],['noteCount','划线数','number','条']]);notes.detail={tool:'opencli.weread.highlights',param:'bookId',fixed:{limit:3},rows:[{chapter:'第一章',text:'证据：留意日常中的细微变化。',createTime:'2026-10-30'}]}
const word=profile('opencli.dictionary.search',{word:'serendipity'},[{word:'serendipity',phonetic:'/ˌserənˈdɪpəti/',type:'noun',definition:'意外发现美好事物的机缘'}],'word',null,[['phonetic','音标'],['type','词性'],['definition','释义']])
const examples=profile('opencli.dictionary.examples',{word:'serendipity'},[{word:'serendipity',example:'The discovery was a happy accident of serendipity.'}],'word',null,[['example','例句']])
const country=profile('opencli.rest-countries.country',{name:'iceland'},[{commonName:'Iceland',capital:'Reykjavík',population:393349,currencies:'ISK',cca3:'ISL'}],'commonName','cca3',[['capital','首都'],['population','人口','number','人'],['currencies','货币']])
const market=profile('opencli.eastmoney.sectors',{type:'industry',sort:'change',limit:3},[{code:'BK1',name:'测试半导体',changePercent:2.7,upCount:20,downCount:3},{code:'BK2',name:'测试新能源',changePercent:-1.2,upCount:6,downCount:19}],'name','code',[['changePercent','涨跌幅','number','%'],['upCount','上涨家数','number','家'],['downCount','下跌家数','number','家']])
const games=profile('opencli.steam.top-sellers',{limit:3},[{name:'星港工坊',price:'¥68',discount:'20%'},{name:'林间冒险',price:'¥88',discount:'0%'}],'name',null,[['price','价格'],['discount','折扣']])
const news=profile('opencli.36kr.news',{limit:3},[{title:'测试：机器人初创企业发布进展',summary:'企业展示新样机，尚未公布量产日期。',date:'2026-11-02'},{title:'测试：创业社区讨论融资',summary:'讨论聚焦现金流与长期研发。',date:'2026-11-01'}],'title',null,[['date','日期'],['summary','摘要']])
const hotel=profile('opencli.ctrip.hotel-search',{city:'2',checkin:'2026-11-07',checkout:'2026-11-08'},[{hotelId:'h1',name:'测试湖边旅店',score:4.5,price:268,currency:'CNY',district:'萧山'},{hotelId:'h2',name:'测试城市驿站',score:4.3,price:298,currency:'CNY',district:'滨江'},{hotelId:'h3',name:'测试豪华酒店',score:4.8,price:568,currency:'CNY',district:'西湖'}],'name','hotelId',[['price','每晚','number','元'],['score','评分','number'],['district','区域']])
const food={...places,input:{keyword:'清淡 亲子',city:'杭州'},rows:places.rows.map((r,i)=>({...r,name:['测试湖边蒸菜馆','测试亲子清汤馆','测试田园小馆'][i],cuisine:'清淡家常菜'}))}
const sources=[[movie],[weather],[train],[places],[food],[car,social],[shop],[video],[podcast],[book],[notes],[word,examples],[country],[market],[games],[news],[current,movie],[],[pause],[hotel]]
const extra=[
 ['B01','找周末可去的亲子地点，多选两个后在地图与计划中同步；没有坐标不造pin。',[places],'地图、多选与计划同步'],
 ['B02','比较杭州上海去程和返程车次，各固定一班，查看票价并保留日期区间。',[train,{...train,input:{...train.input,from:'上海南',to:'杭州东',date:'2026-11-08'},rows:train.rows.map(r=>({...r,from_station:'上海南',to_station:'杭州东'})),detail:{...train.detail,fixed:{from:'上海南',to:'杭州东',date:'2026-11-08'}}}],'双向选择与依赖参数'],
 ['B03','比较五百元内耳机的价格和差评，选中商品后读新增评价；不能用评论ID代替SKU。',[shop],'预算筛选与评价'],
 ['B04','看看尊界车主口碑和社交讨论随时间的变化，给出正负样本数量、时间线和原文依据；不要把评分当情绪。',[car,social],'样本分类与时间统计'],
 ['B05','选一个注意力教学视频读取字幕，切换另一个再回到原视频；没有字幕要保留候选。',[video],'字幕依赖、切换与失败'],
 ['B06','比较杭州当前天气与明天出行建议，摄氏温度、日期和资料来源不能混淆。',[current,weather],'当前与预报区分'],
 ['B07','从一个新来源找科幻剧候选，打开新增详情再返回，字段改名时不要显示虚假暂无。',[profile('opencli.tvmaze.search',{query:'science fiction'},[{id:901,name:'样本远航',language:'English',rating:8.2},{id:902,name:'样本边界',language:'Chinese',rating:7.9}],'name','id',[['language','语言'],['rating','评分','number']])],'新来源配置与详情缺口'],
 ['B08','暂停正在播放的音乐，只在我点击后执行，显示回执，失败可查看原因，刷新不能重放。',[pause],'显式写操作与回执']
]
export const S2_CASES=[...DISCOVERY_CASES.map((c,i)=>({id:c.id,prompt:c.prompt,sources:sources[i],originalExpected:c.expected,static:c.id==='18-static',write:c.id==='19-write'})),...extra.map(([id,prompt,sources,focus])=>({id,prompt,sources,focus,write:id==='B08'}))].map(c=>({...c,sources:c.sources.map((s,i)=>({...s,key:'s'+i})),scope:'Synthetic frozen schemas and responses, not live facts. Original request retained; task coverage assessed separately.'}))
