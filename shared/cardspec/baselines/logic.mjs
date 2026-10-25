// Authoring helpers only. Each exported source is a standalone, no-import
// function embedded verbatim in the downloadable CardSpec.
const COMMON = `
 const s=state,e=event,r=input.response||{};
 if(e.type==="init"&&s.pending){s.pending="";s.message="上次请求已中断，可手动重试";}
 if(e.type==="input"&&s.pending&&input.statuses?.[s.pending]==="cancelled"){s.pending="";s.message="请求已取消，已有内容仍保留";}
 const text=v=>v==null?"":String(v).replace(/<[^>]*>/g,"");
 const key=x=>String(x.rowKey||x.id||x.url||x.title||x.name);
 const clean=rows=>(rows||[]).slice(0,30).map((x,i)=>{
  const v={};for(const [k,t]of Object.entries(x).slice(0,40)){if(t===null||["string","number","boolean"].includes(typeof t))v[k]=typeof t==="string"?text(t).slice(0,900):t;else if(Array.isArray(t)&&t.every(v=>typeof v==="string"))v[k]=t.slice(0,12).map(text).join("、");}
  v.rowKey=key(x)||String(i);v.title=text(x.title||x.name||x.code||x.content||x.text||"未命名").slice(0,120);return v;
 });
 const ask=(op,params)=>{s.request=params;s.pending=op;s.message="正在获取…";};
 const received=!!r.seq&&r.seq!==s.seen;
 if(received){s.seen=r.seq;s.pending="";if(!r.ok)s.message="请求失败，保留已有资料："+text(r.error);}
 if(e.type==="field"){s[e.args.name]=e.value;s.page=0;}
 if(e.type==="tab"){s.tab=e.value;s.page=0;}
 if(e.type==="prev")s.page=Math.max(0,s.page-1);
 if(e.type==="next")s.page++;
 if(e.type==="fault")throw Error("隔离测试：保留上次有效状态");
 const paginate=rows=>{s.page=Math.min(s.page,Math.max(0,Math.ceil(rows.length/3)-1));s.pageRows=rows.slice(s.page*3,s.page*3+3);s.pages=Math.max(1,Math.ceil(rows.length/3));};
`;
function source(fn){return 'function update(state,event,input){'+COMMON+fn.toString().slice(fn.toString().indexOf('{')+1,-1)+'}'}

function sentiment(state,event,input){
 const sourceNames={news:'新闻',weibo:'微博',xhs:'小红书',videos:'B站视频',comments:'B站评论'};
 if(['news','weibo','xhs','videos'].includes(e.type)){
  if(!s.query.trim())throw Error('先填写议题');
  if(s.loadedQuery&&s.loadedQuery!==s.query.trim()){s.sources={};s.labels=[];s.date='';}
  s.loadedQuery=s.query.trim();s.labels=[];
  ask(e.type,e.type==='news'?{keyword:s.loadedQuery,limit:8,lang:'zh',region:'CN'}:e.type==='weibo'?{keyword:s.loadedQuery,limit:8}:{query:s.loadedQuery,limit:8,...(e.type==='videos'?{type:'video'}:{})});
 }
 if(e.type==='select'){s.focus=e.item;s.external=e.item.url||'';}
 if(e.type==='comments'){
  if(!s.focus?.bvid)throw Error('请选择带 BV 号的视频');
  ask('comments',{bvid:s.focus.bvid,limit:12});s.commentParent={title:s.focus.title,url:s.focus.url||'',bvid:s.focus.bvid};
 }
 if(received&&sourceNames[r.op]){
  if(r.ok){
   const unique=new Map();for(const row of clean(r.value.items)){
    row.content=text(row.content||row.text||row.snippet||row.summary||row.title);
    if(r.op==='videos')row.bvid=row.bvid||row.url?.match(/\/video\/(BV[A-Za-z0-9]+)/)?.[1]||'';
    if(r.op==='comments'&&/^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(row.time||''))row.time=row.time.replace(' ','T')+':00Z';
    const id=sourceNames[r.op]+':'+key(row),url=row.url?.replace(/[?#].*$/,'');
    const dedup=r.op==='comments'?id:url||id;
    if(!unique.has(dedup))unique.set(dedup,{...row,rowKey:id,source:sourceNames[r.op],evidenceKind:r.op==='news'?'news':['videos','xhs'].includes(r.op)?'discovery':'feedback',...(r.op==='comments'?{parentTitle:s.commentParent.title,url:row.url||s.commentParent.url}: {})});
   }
   s.sources[r.op]={items:[...unique.values()],stale:false,time:r.value.fetchedAt,partial:r.value.truncated};
   s.labels=[];s.message='已获取 '+sourceNames[r.op]+'；只代表当前样本';
  }else if(s.sources[r.op])s.sources[r.op].stale=true;
 }
 const dayOf=x=>{const raw=x.date||x.time||x.publishedAt||'',stamp=typeof raw==='number'?raw*(raw<1e12?1000:1):Date.parse(raw);return stamp&&Number.isFinite(stamp)?new Date(stamp+28800000).toISOString().slice(0,10):'';};
 const all=Object.values(s.sources).flatMap(v=>v.items.map(x=>({...x,stale:v.stale,day:dayOf(x),displayDate:dayOf(x)||'日期待核实'})));
 const feedback=all.filter(x=>x.evidenceKind==='feedback'&&!x.stale);
 if(e.type==='analyze'){
  if(!feedback.length)throw Error('先获取用户反馈；新闻和视频标题不算态度样本');
  ask('analyze',{items:feedback.slice(0,24).map(x=>({rowKey:x.rowKey,title:x.title,content:x.content.slice(0,400),source:x.source,date:x.day,evidenceKind:x.evidenceKind,parentTitle:x.parentTitle||''})),instruction:'只判断用户对车辆本身的态度，标签只能为正向、负向、中性、不确定、无关。对媒体或测试者的批评不等于车辆负面；缺语境或反讽用不确定。quote 必须来自该行原文，不能用 parentTitle 作为用户态度依据。不推断全网趋势。'});
 }
 if(received&&r.ok&&r.op==='analyze'){
  try{
   const ids=new Map(feedback.map(x=>[key(x),x])),seen=new Set(),labels=[];
   for(const x of r.value.items||[]){const original=ids.get(key(x));if(!original||seen.has(key(x)))throw Error('分类引用失效或重复');seen.add(key(x));
    if(x.analysisLabel==='未分类')continue;
    if(!['正向','负向','中性','不确定','无关'].includes(x.analysisLabel))throw Error('未知态度标签');
    const quote=text(x.analysisQuote),body=[original.title,original.content,original.snippet,original.summary,original.abstract].map(text).join('\n');
    if(!quote.trim()||!body.includes(quote))throw Error('引文不在当前原文中');
    labels.push({id:key(x),label:x.analysisLabel,quote});
   }
   s.labels=labels;s.message='分类完成：有引文的模型判断，可逐项核实';
  }catch(err){s.message='分类未采纳：'+err.message;}
 }
 const labels=new Map(s.labels.map(x=>[x.id,x])),counts={},days={};s.unknown=0;
 for(const x of feedback){
  const label=labels.get(key(x))?.label||'未分析';counts[label]=(counts[label]||0)+1;
  const raw=x.date||x.time||x.publishedAt||'',stamp=typeof raw==='number'?raw*(raw<1e12?1000:1):Date.parse(raw);
  const day=stamp&&Number.isFinite(stamp)?new Date(stamp+28800000).toISOString().slice(0,10):'';
  x.day=day;if(!day)s.unknown++;else{days[day]??={};days[day][label]??=[];days[day][label].push(key(x));}
 }
 s.counts=['正向','负向','中性','不确定','无关','未分析'].map(label=>({id:label,label,value:counts[label]||0}));
 s.series=Object.keys(days).sort().slice(-6).flatMap(day=>Object.entries(days[day]).map(([label,ids])=>({id:day+label,label:day,series:label,value:ids.length,recordIds:ids})));
 s.total=feedback.length;s.coverage=Object.entries(s.sources).map(([id,x])=>({id,label:sourceNames[id],value:x.items.length,status:x.stale?'过期（不计入统计）':x.partial?'部分结果':'已获取'}));
 if(e.type==='chart'){s.attitude=e.series||e.id;s.date=e.series?e.label:'';s.tab='原文';s.page=0;}
 if(e.type==='all'){s.date='';s.attitude='全部';s.page=0;}
 s.rows=s.tab==='新闻时间线'?all.filter(x=>x.evidenceKind==='news').sort((a,b)=>b.day.localeCompare(a.day)):
  s.tab==='社交线索'?all.filter(x=>x.evidenceKind==='discovery'):feedback.map(x=>({...x,attitude:labels.get(key(x))?.label||'未分析',quote:labels.get(key(x))?.quote||''})).filter(x=>(s.attitude==='全部'||x.attitude===s.attitude)&&(!s.date||x.day===s.date));
 s.raw=JSON.stringify(s.focus||{},null,2);paginate(s.rows);return s;
}

export const FAMILY_SCHEMA={type:'object',required:['headline','slots','cautions'],properties:{headline:{type:'string',maxLength:72},slots:{type:'array',maxItems:4,items:{type:'object',required:['ref','day','period','activity','reason'],properties:{ref:{type:'string',maxLength:250},day:{type:'integer',minimum:0,maximum:1},period:{type:'integer',minimum:0,maximum:1},activity:{type:'string',maxLength:70},reason:{type:'string',maxLength:60}}}},cautions:{type:'array',maxItems:3,items:{type:'string',maxLength:70}}}};
function family(state,event,input){
 if(e.type==='field'&&['age','budget','preference'].includes(e.args.name))s.plan=null;
 if(e.type==='search')ask('search',{query:s.query,limit:12});
 if(received&&r.ok&&r.op==='search'){s.rows=clean(r.value.items);s.message='已获取 '+s.rows.length+' 个候选；开放时间、适龄和费用待核实';}
 if(e.type==='focus'){s.focus=e.item;s.external=e.item.url||'';}
 if(e.type==='toggle'){
  const x=s.focus,id=key(x),found=s.selected.some(v=>key(v)===id);
  if(found)s.selected=s.selected.filter(v=>key(v)!==id);else if(s.selected.length<4)s.selected.push({...x});else throw Error('最多选择四处，给午休留出空间');
  s.plan=null;
 }
 if(e.type==='plan'){
  if(!s.selected.length)throw Error('先选择地点');
  s.tab='两天计划';
  ask('plan',{prompt:'仅按 context 选中地点安排周六周日，每个 ref 恰好一次；每天上午下午各最多一个地点，保留午休。不编造开放时间、门票和交通时长；适龄性待核实。只输出 schema JSON。',context:{rows:s.selected.map(x=>({ref:key(x),title:x.title,type:x.displayType||'',city:x.cityName||''})),age:s.age,budget:s.budget,preference:s.preference},schema:input.planSchema});
 }
 if(received&&r.ok&&r.op==='plan'){
  try{
   const submitted=r.input.context.rows.map(x=>x.ref),ids=s.selected.map(key);
   if(JSON.stringify(submitted)!==JSON.stringify(ids)||r.input.context.age!==s.age||r.input.context.budget!==s.budget||r.input.context.preference!==s.preference)throw Error('规划条件已改变，请重新规划');
   const occupied=new Set(),seen=new Set();
   for(const x of r.value.slots){if(!ids.includes(x.ref)||seen.has(x.ref)||occupied.has(x.day+':'+x.period)||![0,1].includes(x.day)||![0,1].includes(x.period))throw Error('地点或时段引用无效');seen.add(x.ref);occupied.add(x.day+':'+x.period);}
   if(seen.size!==ids.length)throw Error('没有覆盖全部选中地点');
   s.plan=r.value;s.message='计划已校验；实际开放与交通仍请确认';
  }catch(err){s.message='规划未采纳：'+err.message;}
 }
 if(e.type==='check'){const k=e.args.key;s.packed[k]=!s.packed[k];}
 if(e.type==='day')s.day=e.value;
 s.schedule=(s.plan?.slots||[]).filter(x=>x.day===s.day).sort((a,b)=>a.period-b.period).map(x=>({...x,...s.selected.find(p=>key(p)===x.ref)}));
 s.pickedIds=s.selected.map(key);paginate(s.rows);return s;
}

function movies(state,event,input){
 const movieRows=rows=>clean(rows).map(x=>{const id=x.id||x.url?.match(/\/subject\/(\d+)/)?.[1];return {...x,...(id?{id:String(id)}:{}),rowKey:'film:'+String(id||x.url||x.rowKey)};});
 if(e.type==='search'){s.tab='发现';ask('search',{keyword:s.query,type:'movie',limit:12});}
 if(e.type==='hot'){s.tab='发现';ask('hot',{limit:12});}
 if(received&&r.ok&&['search','hot'].includes(r.op)){s.rows=movieRows(r.value.items);s.page=0;s.message='已获取候选，图片缺失时保留文字';}
 if(e.type==='select'){s.detail=e.item;s.external=e.item.url||'';s.tab='详情';}
 if(e.type==='detail'){if(!s.detail.id)throw Error('来源未给出有效影片 ID');ask('detail',{id:s.detail.id,type:'movie'});}
 if(received&&r.ok&&r.op==='detail'){
  if(String(s.detail?.id)===String(r.input.id)){const detail=movieRows(r.value.items)[0];if(detail&&String(detail.id)===String(r.input.id)){s.detail={...s.detail,...detail,rowKey:s.detail.rowKey};s.external=s.detail.url||'';s.message='影片资料已更新';}else s.message='详情未匹配原影片，保留已有资料';}
  else s.message='已忽略过期的影片详情';
 }
 if(e.type==='compare'){
  const x=s.detail,id=key(x);if(s.chosen.some(v=>key(v)===id))s.chosen=s.chosen.filter(v=>key(v)!==id);
  else if(s.chosen.length<3)s.chosen.push({...x});else throw Error('最多比较三部');
 }
 if(e.type==='choose'){s.pick={...(e.args.item||s.detail)};s.videos=[];s.tab='去观看';s.external=s.pick.url||'';}
 if(e.type==='remove')s.chosen=s.chosen.filter(x=>key(x)!==e.args.id);
 if(e.type==='videos'){if(!s.pick)throw Error('先选择影片');ask('videos',{query:s.pick.title.split('/')[0].trim()+' 官方 预告',type:'video',limit:6});s.videoFor=key(s.pick);}
 if(received&&r.ok&&r.op==='videos'){
  if(s.pick&&key(s.pick)===s.videoFor&&r.input.query===s.pick.title.split('/')[0].trim()+' 官方 预告'){s.videos=clean(r.value.items);s.message='相关视频不保证正片或播放权';}else s.message='已忽略过期的视频结果';
 }
 if(e.type==='video'){s.external=e.args.url||'';s.message='已更新卡片底部的原始链接';}
 const visible=s.rows.filter(x=>!s.rating||(Number(x.rating)>=Number(s.rating)));
 s.raw=JSON.stringify(s.detail||{},null,2);s.visible=visible;paginate(s.tab==='去观看'?s.videos:visible);s.total=visible.length;return s;
}

function trains(state,event,input){
 if(!s.dates[0]){
  const d=new Date((input.today||'2026-10-20')+'T00:00:00Z'),offset=(5-d.getUTCDay()+7)%7||7;
  d.setUTCDate(d.getUTCDate()+offset);s.dates[0]=d.toISOString().slice(0,10);d.setUTCDate(d.getUTCDate()+2);s.dates[1]=d.toISOString().slice(0,10);
 }
 if(e.type==='leg'){s.leg=Number(e.value);s.page=0;}
 if(e.type==='date')s.dates[s.leg]=e.value;
 if(e.type==='search'){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s.dates[s.leg]))throw Error('请选择出发日期');
  s.tab='查找车次';
  ask('search',{from:s.leg?s.to:s.from,to:s.leg?s.from:s.to,date:s.dates[s.leg],departureAfter:s.after,departureBefore:'24:00',exactStations:true,limit:20});s.queryLeg=s.leg;
 }
 if(received&&r.ok&&r.op==='search'){s.results[s.queryLeg]={items:clean(r.value.items),query:r.input,fetchedAt:r.value.fetchedAt,truncated:r.value.truncated};s.message='查询成功；已固定车次保持不变';}
 if(e.type==='select'){s.candidate={...e.item,query:s.results[s.leg].query,fetchedAt:s.results[s.leg].fetchedAt,leg:s.leg};}
 if(e.type==='pin'){
  if(!s.candidate)throw Error('先选择车次');
  const x=s.candidate;s.tickets[x.leg]={...x,date:x.query.date,from:x.from_station||x.query.from,to:x.to_station||x.query.to,seat:s.seat};
  s.release[x.leg]='';s.candidate=null;s.tab='双程票夹';s.message='已保存完整车次快照';
 }
 if(e.type==='release')s.release[e.args.leg]=e.value;
 if(e.type==='manage'){s.manage=e.args.leg;s.tab='行程管理';}
 if(e.type==='refresh'){
  const t=s.tickets[s.manage];if(!t)throw Error('没有已保存车次');
  const [h,m]=t.start_time.split(':').map(Number),mins=Math.min(1440,h*60+m+1),end=String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0');
  ask('refresh',{from:t.from,to:t.to,date:t.date,departureAfter:t.start_time,departureBefore:end,exactStations:true,limit:20});s.refreshTicket={id:key(t),leg:s.manage,trainNo:t.train_no};
 }
 if(received&&r.ok&&r.op==='refresh'){
  const ref=s.refreshTicket,t=s.tickets[ref.leg],match=clean(r.value.items).find(x=>x.code===t?.code&&x.train_no===ref.trainNo);
  if(!t||key(t)!==ref.id)s.message='行程已改变，忽略旧余票';else if(!match)s.message='未找到原车次，保留票夹，请重新核实';else{s.tickets[ref.leg]={...t,...match,fetchedAt:r.value.fetchedAt};s.message='仅更新原车次余票';}
 }
 const result=s.results[s.leg];s.rows=result?.items||[];paginate(s.rows);s.loaded=result?.query||null;
 s.raw=JSON.stringify(s.tickets[s.manage]||{},null,2);s.copy=s.tickets.filter(Boolean).map(x=>x.date+' '+x.from+' → '+x.to+' '+x.code+' '+x.start_time).join('；');return s;
}

function transformer(state,event,input){
 if(e.type==='token')s.token=Number(e.value);
 if(e.type==='step')s.step=Number(e.value);
 if(e.type==='residual')s.residual=!s.residual;
 if(e.type==='neuron'){s.neuron=Number(e.columnId);s.token=Number(e.rowId);}
 if(e.type==='reset'){s.delta=0;s.residual=true;s.step=0;s.token=0;s.neuron=0;}
 const weights=(n,m,seed)=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>Math.sin((i+1)*13+(j+1)*7+seed)*.6));
 const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0),mat=(w,x)=>w.map(row=>dot(row,x)),add=(a,b)=>a.map((x,i)=>x+b[i]);
 const norm=x=>{const m=x.reduce((a,b)=>a+b,0)/x.length,v=x.reduce((a,b)=>a+(b-m)**2,0)/x.length;return x.map(t=>(t-m)/Math.sqrt(v+1e-5));};
 const gelu=x=>.5*x*(1+Math.tanh(Math.sqrt(2/Math.PI)*(x+.044715*x**3)));
 const softmax=x=>{const a=x.map(t=>Math.exp(t-Math.max(...x))),n=a.reduce((a,b)=>a+b,0);return a.map(t=>t/n);};
 const tokens=s.sentence.trim().split(/\s+/).filter(Boolean).slice(0,6);if(!tokens.length)tokens.push('词');
 const values=tokens.map((t,i)=>Array.from({length:4},(_,j)=>Math.sin([...t].reduce((a,c)=>a+c.codePointAt(0),0)*.01+j*1.7+i*.3)+(j===0?s.delta:0)));
 const ns=values.map(norm),q=ns.map(x=>mat(weights(4,4,1),x)),k=ns.map(x=>mat(weights(4,4,2),x)),v=ns.map(x=>mat(weights(4,4,3),x)),w1=weights(6,4,5),w2=weights(4,6,9),b1=[.1,-.1,.05,0,.08,-.03],b2=[.02,0,-.02,.01];
 s.all=tokens.map((token,i)=>{const attention=softmax(k.map(ki=>dot(q[i],ki)/2)),mixed=Array.from({length:4},(_,j)=>v.reduce((a,x,n)=>a+attention[n]*x[j],0)),a=mat(weights(4,4,4),mixed),h=s.residual?add(values[i],a):a,n=norm(h),z=add(mat(w1,n),b1),activation=z.map(gelu),f=add(mat(w2,activation),b2),y=s.residual?add(h,f):f;return {token,input:values[i],attention,a,h,n,z,activation,f,y};});
 s.token=Math.min(s.token,tokens.length-1);s.cur=s.all[s.token];s.tokens=tokens.map((label,i)=>({value:i,label}));s.axes=tokens.map((label,i)=>({id:String(i),label}));
 s.hidden=Array.from({length:6},(_,i)=>({id:String(i),label:'h'+(i+1)}));s.activation=s.all.map(x=>x.activation);s.attention=s.all.map(x=>x.attention);
 const notes=['教学嵌入：token → 四维向量','Attention(LN(x))：按注意力汇聚 token','h = x + Attention(LN(x))','GELU(W₁ × LN(h) + b₁)','f = W₂ × activation + b₂','y = h + f → 下一层'];
 s.note=notes[s.step]+(!s.residual&&[2,5].includes(s.step)?'（当前残差已关闭）':'');
 s.vector=[s.cur.input,s.cur.a,s.cur.h,s.cur.activation,s.cur.f,s.cur.y][s.step].map((value,i)=>({id:String(i),label:'d'+(i+1),value}));
 s.contributions=s.cur.n.map((n,i)=>({id:String(i),label:'n'+(i+1)+'×W₁',value:n*w1[s.neuron][i]}));
 s.bias=b1[s.neuron];s.z=s.cur.z[s.neuron];s.activated=s.cur.activation[s.neuron];s.output=s.cur.y.map(x=>Math.round(x*1000)/1000).join(' · ');
 return s;
}

const base={seen:0,pending:'',message:'',request:{},page:0,pages:1,pageRows:[],external:'',raw:'{}'};
export const SEEDS={
 sentiment:{...base,query:'尊界 刹车',loadedQuery:'',tab:'态度概览',attitude:'全部',date:'',sources:{},labels:[],rows:[],focus:null,commentParent:{title:'',url:'',bvid:''},counts:[],series:[],coverage:[],total:0,unknown:0},
 family:{...base,query:'杭州 萧山 亲子',tab:'地图选点',age:'3–6岁',budget:300,preference:'留足午休',rows:[],selected:[],pickedIds:[],focus:null,plan:null,day:0,schedule:[],packed:{}},
 movies:{...base,query:'科幻',tab:'发现',rating:0,rows:[],visible:[],chosen:[],detail:null,pick:null,videos:[],videoFor:'',total:0},
 trains:{...base,tab:'双程票夹',leg:0,from:'杭州东',to:'上海虹桥',dates:['',''],after:'12:00',seat:'second_seat',tickets:[null,null],release:['',''],results:[null,null],candidate:null,queryLeg:0,manage:0,refreshTicket:null,copy:'',loaded:null,rows:[]},
 transformer:{...base,sentence:'我 喜欢 杭州',token:0,step:0,delta:0,residual:true,neuron:0,tab:'数值流',all:[],tokens:[{value:0,label:'我'},{value:1,label:'喜欢'},{value:2,label:'杭州'}],axes:[],hidden:[],activation:[],attention:[],vector:[],contributions:[],bias:0,z:0,activated:0,output:'',note:'',cur:null}
};
export const SOURCES={sentiment:source(sentiment),family:source(family),movies:source(movies),trains:source(trains),transformer:source(transformer)};
