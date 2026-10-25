// Explicit deterministic QA transport; never used as a live error fallback.
const fetchedAt='2026-10-20T02:00:00Z';
const envelope=items=>({items,source:'测试数据 · 不代表实时事实',fetchedAt,truncated:false});
const films=[
 {id:'1292722',rowKey:'1292722',title:'测试 · 星际航行',rating:8.8,genres:'科幻',duration:'120分钟',abstract:'关于一次远行和归来的测试简介。',url:'https://movie.douban.com/subject/1292722/'},
 {id:'1291546',rowKey:'1291546',title:'测试 · 城市回声',rating:7.5,genres:'剧情',duration:'100分钟',abstract:'用于比较与选择的测试资料。',url:'https://movie.douban.com/subject/1291546/'},
 {id:'1292052',rowKey:'1292052',title:'测试 · 森林之约',rating:9.1,genres:'动画',duration:'90分钟',abstract:'用于验证评分筛选的测试资料。',url:'https://movie.douban.com/subject/1292052/'},
 ...Array.from({length:4},(_,i)=>({id:String(1300000+i),rowKey:String(1300000+i),title:'测试 · 候选电影 '+(i+4),rating:7+i*.4,url:'https://movie.douban.com/subject/'+(1300000+i)+'/'}))
];
const comments=[
 {id:'c1',rowKey:'c1',title:'测试反馈甲',content:'我对这辆车的可靠性感到担心。',time:'2026-10-18T10:00:00+08:00'},
 {id:'c2',rowKey:'c2',title:'测试反馈乙',content:'我对这辆车的体验很满意。',time:'2026-10-19T11:00:00+08:00'},
 {id:'c3',rowKey:'c3',title:'测试反馈丙',content:'还需要完整的测试条件才能判断。',time:''}
];
export function fixtureValue(tool,input={}){
 if(tool==='opencli.google.news')return envelope([{id:'n1',rowKey:'n1',title:'测试新闻 · 等待完整检测资料',summary:'这是一条测试新闻，不是用户态度。',date:'2026-10-17',url:'https://example.com/news/1'}]);
 if(['opencli.weibo.search','opencli.xiaohongshu.search','opencli.bilibili.comments'].includes(tool))return envelope(comments.map((x,i)=>({...x,url:'https://example.com/comment/'+i})));
 if(tool==='opencli.bilibili.search')return envelope([{id:'BV1xx411c7mD',bvid:'BV1xx411c7mD',rowKey:'BV1xx411c7mD',title:'测试 · '+input.query,author:'测试作者',url:'https://www.bilibili.com/video/BV1xx411c7mD/'}]);
 if(tool==='dataset.analyze')return {...envelope(input.items.map(x=>({...x,analysisLabel:x.content?.includes('担心')?'负向':x.content?.includes('满意')?'正向':'不确定',analysisQuote:x.content||x.title}))),analysis:{scope:'fixture only'}};
 if(tool==='opencli.ctrip.search')return envelope([
  {id:'p1',rowKey:'p1',name:'测试 · 湖畔公园',displayType:'公园',lat:30.185,lon:120.263,cityName:'杭州',url:'https://example.com/poi/1'},
  {id:'p2',rowKey:'p2',name:'测试 · 自然博物馆',displayType:'博物馆',lat:30.175,lon:120.28,cityName:'杭州',url:'https://example.com/poi/2'},
  {id:'p3',rowKey:'p3',name:'测试 · 植物园',displayType:'公园',lat:30.195,lon:120.24,cityName:'杭州',url:'https://example.com/poi/3'},
  {id:'p4',rowKey:'p4',name:'测试 · 缺少坐标',displayType:'室内',cityName:'杭州'}
 ]);
 if(tool==='glm.generate')return {headline:'测试规划 · 留足午休的两天',slots:input.context.rows.map((r,i)=>({ref:r.ref,day:Math.floor(i/2),period:i%2,activity:'观察与探索，按孩子体力调整',reason:'保留弹性；适龄与开放待核实'})),cautions:['门票、开放时间和交通待核实']};
 if(['opencli.douban.search','opencli.douban.movie-hot'].includes(tool))return envelope(films);
 if(tool==='opencli.douban.subject')return envelope([{...films.find(x=>x.id===String(input.id)),summary:'测试完整资料：选择、比较和再次查询不能覆盖今晚已保存的影片。'}]);
 if(tool==='opencli.12306.trains')return envelope(Array.from({length:6},(_,i)=>({rowKey:input.date+'-'+i,id:input.date+'-'+i,code:'测试 G'+(101+i),train_no:'train'+i,from_station:input.from,to_station:input.to,start_time:(13+i)+':20',arrive_time:(14+i)+':15',duration:'00:55',second_seat:i===2?'无':'有',first_seat:'未知',departure_date:input.date})).filter(x=>x.start_time>=(input.departureAfter||'00:00')&&x.start_time<(input.departureBefore||'24:00')));
 throw Error('测试替身没有此工具：'+tool);
}
export async function fixtureTransport(payload,signal){
 await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,100);signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'))},{once:true});});
 signal?.throwIfAborted();return {kind:'json',value:fixtureValue(payload.tool,payload.input)};
}
