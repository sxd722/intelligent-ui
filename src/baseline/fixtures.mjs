// Explicit offline fixtures for repeatable interaction checks. Never used as live fallback.
export function fixture(tool,input){
 const envelope=items=>({items,source:'演示快照（非实时事实）',fetchedAt:'2026-10-19T02:00:00Z',truncated:false});
 if(tool==='opencli.google.search'||tool==='opencli.google.news')return envelope([{title:'示例：品牌发布技术说明',snippet:'演示数据，不描述真实事件。',url:'https://example.com/news/1',time:'2026-10-17'},{title:'示例：第三方报道追踪',snippet:'等待查证的报道线索。',url:'https://example.com/news/2',time:'2026-10-18'}]);
 if(tool==='opencli.weibo.search')return envelope([{id:'demo1',title:'示例用户反馈：希望公开检测过程',author:'示例用户',time:'2026-10-18',url:'https://example.com/post/1'},{id:'demo2',title:'示例用户反馈：关注后续解释',time:'2026-10-19',url:'https://example.com/post/2'}]);
 if(tool==='opencli.dongchedi.search')return envelope([{series_id:'demo',name:'演示车系'}]);
 if(tool==='opencli.dongchedi.koubei')return envelope([{content:'示例口碑：希望补充更多检测数据',user:'演示车主',url:'https://example.com/review/1'}]);
 if(tool==='opencli.12306.trains')return envelope(Array.from({length:5},(_,i)=>({rowKey:'demo-'+input.date+'-'+i,code:'演示 G'+(101+i),from_station:input.from,to_station:input.to,start_time:`${13+i}:20`,arrive_time:`${14+i}:15`,duration:'00:55',second_seat:i===2?'无':'有',first_seat:'未知',departure_date:input.date,train_no:'demo'+i})));
 if(tool==='opencli.douban.search')return envelope([{id:'demo-a',title:'星际穿越（演示）',rating:'9.4',abstract:'科幻 / 亲情 / 169分钟',url:'https://example.com/movie/1'},{id:'demo-b',title:'机器人总动员（演示）',rating:'9.3',abstract:'动画 / 冒险 / 98分钟',url:'https://example.com/movie/2'},{id:'demo-c',title:'火星救援（演示）',rating:'8.5',abstract:'科幻 / 生存 / 144分钟',url:'https://example.com/movie/3'}]);
 if(tool==='opencli.douban.subject')return envelope([{id:input.id,title:'示例电影详情',duration:'98分钟',genres:['动画','冒险'],directors:['示例导演'],summary:'这是供交互测试使用的电影资料。它不代表实时检索结果。',rating:'9.3',url:'https://example.com/movie/2'}]);
 if(tool==='opencli.bilibili.search')return envelope([{id:'video1',title:'演示：官方预告线索（非已核实片源）',author:'演示账号',url:'https://example.com/video/1'},{id:'video2',title:'演示：影评与幕后',url:'https://example.com/video/2'}]);
 if(tool==='opencli.ctrip.search'||tool==='opencli.dianping.search')return envelope([{id:'p1',name:'示例湖畔公园',displayType:'公园',lat:30.15,lon:120.23,cityName:'杭州',district:'萧山',url:'https://example.com/place/1'},{id:'p2',name:'示例自然博物馆',displayType:'博物馆',lat:30.18,lon:120.25,cityName:'杭州',district:'萧山',url:'https://example.com/place/2'},{id:'p3',name:'示例亲子农场',displayType:'农场',lat:30.17,lon:120.29,cityName:'杭州',district:'萧山',url:'https://example.com/place/3'}]);
 throw Error('此工具无演示快照');
}
