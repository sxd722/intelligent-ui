// Public demo transport. Never a fallback for a failing real CLI.
import {validateToolInput} from './tools.mjs'
export const DEMO_NOTICE='演示数据 · 全部为虚构样本，不代表实时新闻、真实用户意见、营业信息、评分或余票。'
export const DEMO_TOOL_IDS=['opencli.google.news','opencli.weibo.search','opencli.xiaohongshu.search','opencli.bilibili.search','opencli.bilibili.comments','opencli.ctrip.search','opencli.douban.search','opencli.douban.movie-hot','opencli.douban.subject','opencli.12306.trains','opencli.12306.train']
export const DEMO_ASSETS={
 movie1:['星际邮差','#253f75','#a8dce8'],movie2:['小城回声','#87583f','#f6c68b'],movie3:['森林来信','#28645c','#b7e0aa'],movie4:['雨夜谜题','#524263','#d8b3d4'],movie5:['慢慢长大','#976348','#f4db9c'],movie6:['月球假日','#363e69','#becbef'],
 poi1:['湖畔观察','#28645c','#b5e0d2'],poi2:['自然探索','#685879','#e7c9a1'],poi3:['植物漫步','#386240','#cbe698'],poi4:['室内创作','#8d6544','#f9d8ab'],
}
const movies=[
 ['movie1','星际邮差','科幻',8.6,118,'一位邮差穿越星际，为陌生人送回遗失的记忆。'],
 ['movie2','小城回声','剧情',7.8,104,'旧电台里的声音，连接起一座小城的三代人。'],
 ['movie3','森林来信','动画',8.9,92,'小狐狸和朋友沿着森林中的线索，寻找春天的第一封信。'],
 ['movie4','雨夜谜题','悬疑',8.1,109,'暴雨困住的旅客，必须一起解开一段录音的秘密。'],
 ['movie5','慢慢长大','家庭',7.6,96,'一家人在周末旅行中学会倾听彼此。'],
 ['movie6','月球假日','科幻 喜剧',8.2,102,'一次失误让两位游客成为月球临时向导。'],
].map(([id,title,genres,rating,duration,abstract])=>({id,rowKey:id,title:'演示 · '+title,genres:[genres],rating,duration,abstract,summary:abstract,assetRef:'asset.v1.demo.'+id,assetKind:'illustration',year:2026}))
const pois=[
 {id:'poi1',name:'演示 · 湖畔观察公园',displayType:'公园',lat:30.185,lon:120.263,summary:'观察水鸟，沿湖短距离散步。',cost:0},
 {id:'poi2',name:'演示 · 自然探索馆',displayType:'博物馆',lat:30.175,lon:120.28,summary:'室内标本与自然互动展。',cost:null},
 {id:'poi3',name:'演示 · 四季植物园',displayType:'公园',lat:30.195,lon:120.24,summary:'寻找叶片形状，制作观察记录。',cost:20},
 {id:'poi4',name:'演示 · 小小创作坊',displayType:'室内',summary:'缺少坐标的手工候选，不应在地图上制造位置。',cost:null},
].map(r=>({...r,rowKey:r.id,cityName:'杭州',assetRef:'asset.v1.demo.'+r.id,assetKind:'illustration',coordinateNotice:'虚构地点的示意坐标，不用于导航',openingHours:null}))
const feedback=[
 ['担忧','看到讨论后有些担心可靠性，希望公布完整测试条件。','2026-10-17','负面'],
 ['体验','我的使用体验不错，对这辆车整体满意。','2026-10-17','正面'],
 ['等待','资料还不完整，现在无法判断原因。','2026-10-18','不确定'],
 ['疑问','我担心售后能否及时回应这类问题。','2026-10-18','负面'],
 ['认可','目前驾驶感受很好，舒适性让我满意。','2026-10-19','正面'],
 ['信息','我只在关注检测进展，没有形成评价。','2026-10-19','中性'],
 ['闲聊','今天的晚霞很好看。','2026-10-19','无关'],
 ['未知','补充资料后再讨论。','','不确定'],
]
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export function demoAsset(ref){
 const id=String(ref).replace(/^asset\.v1\.demo\./,''),a=DEMO_ASSETS[id]
 if(!a||ref!=='asset.v1.demo.'+id)return null
 return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${a[1]}"/><stop offset="1" stop-color="${a[2]}"/></linearGradient></defs><rect width="360" height="480" rx="24" fill="url(#g)"/><circle cx="260" cy="132" r="76" fill="white" opacity=".25"/><path d="M-20 350L120 160 230 300 310 230 400 390V500H-20Z" fill="white" opacity=".22"/><text x="28" y="390" fill="white" font-size="30" font-family="sans-serif">${a[0]}</text><text x="28" y="435" fill="white" font-size="17" font-family="sans-serif">演示插画 · 非真实海报 / 地点</text></svg>`
}
export function demoSourcePage(url){
 const title=(url.searchParams.get('title')||'演示来源').slice(0,180)
 return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>演示来源</title><body style="font:17px/1.7 system-ui;max-width:640px;margin:60px auto;padding:24px;background:#f5f7f8;color:#20323a"><h1>${escape(title)}</h1><p>${DEMO_NOTICE}</p><p>此链接用于演示卡片中的来源查看、详情和返回流程。它没有指向真实人物的发言或真实事件报道，不能用于出行、购票或事实判断。</p><a href="/">返回卡片生成器</a></body></html>`
}
export function demoToolValue(tool,input={},origin='https://demo.invalid'){
 if(!DEMO_TOOL_IDS.includes(tool))throw Object.assign(Error('此工具未在云端演示目录开放'),{code:'SERVICE_UNAVAILABLE'})
 validateToolInput(tool,input)
 const sourceUrl=(id,title)=>{const u=new URL('/api/demo/source',origin);u.searchParams.set('id',id);u.searchParams.set('title',title);return u.href}
 const link=r=>({...r,url:sourceUrl(r.rowKey||r.id,r.title||r.name||'演示来源'),source:'演示 · '+tool,demo:true})
 let items=[]
 if(tool==='opencli.google.news')items=[
  {id:'news1',title:'演示事件：相关讨论出现',date:'2026-10-17',summary:'虚构时间线节点；用于展示新闻与用户态度分开统计。'},
  {id:'news2',title:'演示事件：等待测试条件说明',date:'2026-10-18',summary:'没有可验证的真实检测结论，不推断故障原因。'},
  {id:'news3',title:'演示事件：资料核对中',date:'2026-10-20',summary:'此演示不证明任何品牌发生过所描述事件。'},
 ].map(r=>({...r,rowKey:r.id,query:input.keyword||''}))
 if(['opencli.weibo.search','opencli.xiaohongshu.search','opencli.bilibili.comments'].includes(tool)){
  if(tool==='opencli.bilibili.comments'&&!/^DEMO_BV_[1-3]$/.test(input.bvid))throw Object.assign(Error('演示视频不存在，请使用查询返回的 bvid'),{code:'INVALID_INPUT'})
  items=feedback.map(([name,content,date],i)=>({id:tool+':feedback'+i,rowKey:tool+':feedback'+i,title:'演示观点 · '+name,content,author:'虚构用户'+(i+1),date,time:date?date+'T10:00:00+08:00':'',query:input.keyword||input.query||input.bvid}))
 }
 if(tool==='opencli.bilibili.search')items=Array.from({length:3},(_,i)=>({id:'DEMO_BV_'+(i+1),rowKey:'DEMO_BV_'+(i+1),bvid:'DEMO_BV_'+(i+1),title:'演示 · '+input.query+' · '+['背景介绍','观点讨论','解说片段'][i],author:'演示创作者',duration:180+i*60,play_count:100+i*20}))
 if(tool==='opencli.ctrip.search'){
  const query=input.query.toLowerCase();items=pois.filter(r=>!/(博物馆|室内|公园|植物)/.test(query)||[r.name,r.displayType].some(t=>t.includes(query)||query.includes(r.displayType)))
 }
 if(tool==='opencli.douban.movie-hot')items=movies
 if(tool==='opencli.douban.search')items=input.type&&input.type!=='movie'?[]:movies.filter(r=>/^(电影|推荐|热映|今晚|全部)$/.test(input.keyword)||[r.title,r.genres.join(' '),r.abstract].some(s=>s.includes(input.keyword)))
 if(tool==='opencli.douban.subject'){
  const row=movies.find(r=>r.id===String(input.id))
  if(!row)throw Object.assign(Error('演示电影不存在，请选择榜单返回的 id'),{code:'INVALID_INPUT'})
  items=[{...row,director:'虚构导演',cast:['虚构演员甲','虚构演员乙'],ticketPrice:null,ticketInventory:null}]
 }
 if(tool==='opencli.12306.trains'||tool==='opencli.12306.train'){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||!Number.isFinite(Date.parse(input.date+'T00:00:00Z')))throw Object.assign(Error('日期应为 YYYY-MM-DD'),{code:'INVALID_INPUT'})
  const times=['08:20','10:20','13:20','14:20','16:20','18:20']
  const rows=times.map((start,i)=>({id:[input.date,input.from,input.to,i].join('|'),rowKey:[input.date,input.from,input.to,i].join('|'),code:'演示 G'+(101+i),train_no:'DEMO_TRAIN_'+i,from_station:input.from,to_station:input.to,departure_date:input.date,start_time:start,arrive_time:String(Number(start.slice(0,2))+1).padStart(2,'0')+':15',duration:'00:55',second_seat:i===2?'无':'有',first_seat:'未知',price:null,saleStartAt:null}))
  if(tool==='opencli.12306.train'){
   const row=rows.find(r=>r.train_no===input.trainNo);if(!row)throw Object.assign(Error('演示车次不存在，请使用查询返回的 train_no'),{code:'INVALID_INPUT'})
   items=[{id:'stop1',rowKey:row.id+'|1',station_name:input.from,arrive_time:'--',start_time:row.start_time,station_no:'01'},{id:'stop2',rowKey:row.id+'|2',station_name:input.to,arrive_time:row.arrive_time,start_time:'--',station_no:'02'}]
  }else items=rows.filter(r=>r.start_time>=(input.departureAfter||'00:00')&&r.start_time<(input.departureBefore||'24:00'))
 }
 const total=items.length,limit=input.limit||20
 items=items.slice(0,limit).map(link)
 return {items,source:DEMO_NOTICE+' · '+tool,fetchedAt:new Date().toISOString(),truncated:total>items.length,coverage:{complete:total<=items.length,total,returned:items.length,matched:total}}
}
