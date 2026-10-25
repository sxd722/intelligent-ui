export const CASES=[['sentiment','01','舆情观察','从声音，到证据'],['family','02','周末亲子','把两天留给好奇心'],['movies','04','今晚看什么','找到一起喜欢的那一部'],['transformer','05','计算显微镜','看见一个 token 的旅程'],['trains','08','周末双城','把出发与归来收进口袋']];
export const ALLOWED={sentiment:['opencli.google.news','opencli.google.search','opencli.weibo.search','opencli.xiaohongshu.search','opencli.bilibili.search','opencli.bilibili.comments','opencli.dongchedi.search','opencli.dongchedi.koubei'],family:['opencli.ctrip.search','opencli.dianping.search'],movies:['opencli.douban.search','opencli.douban.subject','opencli.douban.movie-hot','opencli.bilibili.search'],transformer:['opencli.google.search'],trains:['opencli.12306.trains','opencli.12306.stations']};
export const list=v=>Array.isArray(v)?v:(v?.items||[]);
export const text=v=>v==null?'':Array.isArray(v)?v.join(' / '):typeof v==='object'?'':String(v);
export function isoDay(v){const s=text(v);if(/(?:GMT|UTC|T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2}))/.test(s)&&/20\d{2}/.test(s)){const d=new Date(s);if(Number.isFinite(d.getTime()))return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}const m=s.match(/\b(20\d{2})[-年/](\d{1,2})[-月/](\d{1,2})/);if(!m)return null;const d=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;return !isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d?d:null}
export function canonicalUrl(v){try{const u=new URL(v);if(u.protocol!=='https:')return '';u.hash='';for(const k of [...u.searchParams.keys()])if(/^(utm_|spm|from$)/.test(k))u.searchParams.delete(k);return u.href}catch{return ''}}
export function evidenceGroups(records){
 const groups=new Map();for(const r of records){const title=text(r.title||r.content||r.snippet).trim(),url=canonicalUrl(r.url);if(!title&&!url)continue;const key=url||`${r.source}:${r.id||title}`;if(groups.has(key)){groups.get(key).copies++;continue}groups.set(key,{...r,key,title,copies:1,date:isoDay(r.time||r.publishedAt||r.date)||(/^20\d{2}[年/-]/.test(text(r.snippet))?isoDay(r.snippet):null),dateEvidence:r.time||r.publishedAt||r.date?'来源标注日期':'搜索摘要日期（待核实）',url});}
 // Identical normalized headlines are grouped as possible republications, never asserted to be one verified event.
 const headlines=new Map();for(const r of groups.values()){const key=r.title.replace(/[\s\p{P}]/gu,'').slice(0,120);if(key&&headlines.has(key)){headlines.get(key).related.push(r);continue}headlines.set(key||r.key,{...r,related:[]})}return [...headlines.values()];
}
export function countBy(rows,key){return Object.entries(rows.reduce((a,r)=>{const k=r[key]||'日期未知';a[k]=(a[k]||0)+1;return a},{})).sort((a,b)=>a[0].localeCompare(b[0]))}
export const add=(a,b)=>a.map((x,i)=>x+b[i]);
export const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export const mat=(w,x)=>w.map(row=>dot(row,x));
export function norm(x){const mean=x.reduce((a,b)=>a+b,0)/x.length,v=x.reduce((a,b)=>a+(b-mean)**2,0)/x.length;return x.map(t=>(t-mean)/Math.sqrt(v+1e-5))}
export const softmax=x=>{const m=Math.max(...x),e=x.map(v=>Math.exp(v-m)),s=e.reduce((a,b)=>a+b,0);return e.map(v=>v/s)};
export const gelu=x=>0.5*x*(1+Math.tanh(Math.sqrt(2/Math.PI)*(x+0.044715*x**3)));
const weights=(n,m,seed)=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>Math.sin((i+1)*13+(j+1)*7+seed)*0.6));
export const W1=weights(6,4,5),W2=weights(4,6,9),B1=[.1,-.1,.05,0,.08,-.03],B2=[.02,0,-.02,.01];
export function compute(sentence='我 喜欢 杭州',delta=0,residual=true){
 const tokens=sentence.trim().split(/\s+/).filter(Boolean).slice(0,6);if(!tokens.length)tokens.push('词');
 const input=tokens.map((t,i)=>Array.from({length:4},(_,j)=>Math.sin([...t].reduce((a,c)=>a+c.codePointAt(0),0)*.01+j*1.7+i*.3)+(j===0?delta:0)));
 const ns=input.map(norm),q=ns.map(x=>mat(weights(4,4,1),x)),k=ns.map(x=>mat(weights(4,4,2),x)),v=ns.map(x=>mat(weights(4,4,3),x));
 return tokens.map((token,i)=>{const attention=softmax(k.map(ki=>dot(q[i],ki)/2)),mixed=Array.from({length:4},(_,j)=>v.reduce((s,x,n)=>s+attention[n]*x[j],0)),a=mat(weights(4,4,4),mixed),h=residual?add(input[i],a):a,n=norm(h),z=add(mat(W1,n),B1),activation=z.map(gelu),f=add(mat(W2,activation),B2),y=residual?add(h,f):f;return {token,input:input[i],attention,a,h,n,z,activation,f,y}});
}
export function releaseStatus(release,now=Date.now()){if(!release)return {label:'起售时间待确认',remaining:null};const t=Date.parse(release+'+08:00');if(!Number.isFinite(t))return {label:'起售时间无效',remaining:null};const d=Math.max(0,Math.ceil((t-now)/1000));return {label:d?`${Math.floor(d/86400)}天 ${String(Math.floor(d/3600)%24).padStart(2,'0')}:${String(Math.floor(d/60)%60).padStart(2,'0')}:${String(d%60).padStart(2,'0')}`:'已到起售时间，请查询',remaining:d}}
export function nextWeekend(now=new Date()){const s=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now),d=new Date(s+'T12:00:00+08:00');let diff=(5-d.getUTCDay()+7)%7;d.setUTCDate(d.getUTCDate()+diff);const fri=d.toISOString().slice(0,10);d.setUTCDate(d.getUTCDate()+2);return [fri,d.toISOString().slice(0,10)]}

export function minuteAfter(time){const [h,m]=time.split(':').map(Number);const n=h*60+m+1;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`}
