import {CASES,ALLOWED,canonicalUrl} from './core.mjs';
import {invokeTool} from './transport.mjs';
import {fixture} from './fixtures.mjs';
import {insightRequest,validateInsight,safeExternal} from './insights.mjs';
import {insightFixture} from './insight-fixtures.mjs';
const q=new URLSearchParams(location.search),demo=q.get('fixtures')==='1';
let active=CASES.some(c=>c[0]===q.get('case'))?q.get('case'):'sentiment',width=Number(q.get('width'))||432,size=q.get('size')==='auto'?'auto':'square',token='',controllers=new Map(),knownUrls=new Set(),pendingKeys=new Map(),events=[],saveKey='',currentState={},generation=0;
let knownAssets=new Set(),assetCache=new Map(),assetQueue=Promise.resolve();
const tileCache=new Map();let tileRequests=0,analysisBusy=false;
const illustrationCache=new Map();
const dataUrl=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('图片读取失败'));r.readAsDataURL(blob)});
const sessionId=crypto.randomUUID(),frame=document.querySelector('iframe'),$=s=>document.querySelector(s);
const notice=s=>{$('#notice').textContent=s};
function openLink(url){window.open(url,'_blank','noopener,noreferrer');notice('如果浏览器拦截了新窗口，可点击：');const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='打开刚才选择的来源 ↗';$('#notice').append(a)}
const load=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
const store=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{notice('存储空间不足，请导出；刷新恢复可能受限');return false}};
function trace(type,data){events.push({at:new Date().toISOString(),type,...data});if(events.length>200)events.shift();store(saveKey+':trace',events);$('#trace-count').textContent=events.length}
function remember(v){if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(remember);return}for(const [k,x]of Object.entries(v)){if(k==='assetRef'&&typeof x==='string'&&x.startsWith('asset.v1.'))knownAssets.add(x);else if(k==='url'&&canonicalUrl(x))knownUrls.add(canonicalUrl(x));else if(x&&typeof x==='object')remember(x)}}
const send=(id,result,error)=>frame.contentWindow?.postMessage({baseline:token,id,result,error},'*');
let bundle,css,version;
async function mount(){
 generation++;analysisBusy=false;tileRequests=0;knownAssets=new Set();assetCache=new Map();assetQueue=Promise.resolve();controllers.forEach(c=>c.abort());controllers.clear();pendingKeys.clear();token=crypto.randomUUID();knownUrls=new Set(['https://kyfw.12306.cn/otn/leftTicket/init','https://arxiv.org/abs/1706.03762','https://arxiv.org/abs/2002.04745','https://www.openstreetmap.org/copyright']);
 saveKey=`rsi-h5:${version}:${active}:${demo?'fixture':'live'}`;currentState=load(saveKey)||{};remember(currentState);events=load(saveKey+':trace')||[];
 $('#switch-mode').href=demo?'?case='+active:'?case='+active+'&fixtures=1';$('#case-title').textContent=CASES.find(c=>c[0]===active)[2];$('#case-note').textContent=CASES.find(c=>c[0]===active)[3];$('#mode').textContent=demo?'演示快照 · 不作为实时事实':'真实工具 · 点击后读取';$('#feedback').value=load(saveKey+':feedback')?.note||'';
 $('#trace-count').textContent=events.length;document.querySelectorAll('[data-case]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.case===active)));
 frame.style.width=width+'px';frame.style.height=(size==='square'?width:650)+'px';frame.title=CASES.find(c=>c[0]===active)[2]+' H5 交互卡';
 const cfg=JSON.stringify({token,caseId:active,state:currentState,size,demo,origin:location.origin}).replace(/</g,'\\u003c');
 const csp=`default-src 'none'; script-src 'nonce-${token}'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; frame-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'`;
 frame.srcdoc=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>${css}</style><div id="root"></div><script nonce="${token}">window.BASELINE=${cfg};${bundle.replace(/<\/script/gi,'<\\/script')}</script>`;
 history.replaceState(null,'',`?case=${active}&width=${width}&size=${size}${demo?'&fixtures=1':''}`);notice('状态按案例、版本与数据模式独立保存');
}
window.addEventListener('message',async e=>{
 const m=e.data;if(e.source!==frame.contentWindow||e.origin!=='null'||m?.baseline!==token||JSON.stringify(m).length>1500000)return;
 const current=generation;
 if(m.type==='asset'){
  if(!knownAssets.has(m.assetRef)){send(m.id,null,'图片引用未授权');return}
  if(!assetCache.has(m.assetRef)){const work=assetQueue.catch(()=>{}).then(async()=>{if(current!==generation)throw Error('页面已离开');const r=await fetch('/api/tools/assets/'+encodeURIComponent(m.assetRef));if(!r.ok)throw Error('图片暂不可用');const blob=await r.blob();if(blob.size>3*1024*1024||!/^image\/(webp|jpeg|png)$/.test(blob.type))throw Error('图片格式不支持');return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('图片读取失败'));reader.readAsDataURL(blob)})});assetQueue=work;assetCache.set(m.assetRef,work)}
  try{const result=await assetCache.get(m.assetRef);if(current===generation)send(m.id,result)}catch(e){if(current===generation)send(m.id,null,e.message)}return;
 }
 if(m.type==='save'){currentState=m.state;store(saveKey,currentState);remember(currentState);return}
 if(m.type==='height'&&size==='auto'){frame.style.height=Math.max(320,Math.min(680,m.height))+'px';return}
 if(m.type==='trace'){trace('interaction',{label:String(m.label).slice(0,160)});return}
 if(m.type==='error'){trace('component-error',{message:String(m.message).slice(0,500)});return}
 if(m.type==='cancel'){controllers.get(m.id)?.abort();return}
 if(m.type==='illustration'&&active==='family'){
  const queries={park:'children park nature',museum:'museum exhibition',farm:'family farm animals',indoor:'children indoor playground'},query=queries[m.kind];
  if(!query||demo){send(m.id,null,'示意图片未加载');return}
  try{if(!illustrationCache.has(m.kind)){const work=(async()=>{
    const r=await fetch('/api/photo?role=thumbnail&query='+encodeURIComponent(query),{signal:AbortSignal.timeout(18000)});if(!r.ok)throw Error('图库暂不可用');const photo=await r.json();if(!/^\/api\/media\/[a-f0-9]+\.jpg$/.test(photo.content))throw Error('图片来源不被允许');
    const image=await fetch(photo.content);if(!image.ok)throw Error('图片读取失败');const blob=await image.blob();if(blob.size>3*1024*1024||!/^image\/(jpeg|png|webp)$/.test(blob.type))throw Error('图片格式不支持');return {src:await dataUrl(blob),credit:photo.photographer,photoUrl:photo.photoUrl};})();illustrationCache.set(m.kind,work);work.catch(()=>illustrationCache.delete(m.kind));}
   const result=await illustrationCache.get(m.kind);if(current===generation){if(canonicalUrl(result.photoUrl))knownUrls.add(canonicalUrl(result.photoUrl));send(m.id,result)}
  }catch(err){if(current===generation)send(m.id,null,err.message)}return
 }
 if(m.type==='external'&&active==='movies'&&['tickets','bilibili'].includes(m.kind)){const u=safeExternal(m.kind,String(m.query||''));openLink(u);trace('open-channel',{kind:m.kind,url:u});return}
 if(m.type==='tile'&&active==='family'){
  const {z,x,y}=m;const key=`${z}/${x}/${y}`;
  if(demo||![z,x,y].every(Number.isInteger)||z<1||z>14||x<0||y<0||x>=2**z||y>=2**z){send(m.id,null,'地图底图未加载');return}
  try{if(!tileCache.has(key)){
    if(++tileRequests>24)throw Error('地图加载次数已达本页上限');
    // Only visible viewport tiles; browser HTTP cache is retained, never prefetch.
    const work=fetch(`https://tile.openstreetmap.org/${key}.png`,{referrerPolicy:'strict-origin-when-cross-origin',signal:AbortSignal.timeout(12000)}).then(async r=>{if(!r.ok)throw Error('地图底图暂不可用');const b=await r.blob();if(b.size>500000||b.type!=='image/png')throw Error('地图图片格式错误');return dataUrl(b)});
    tileCache.set(key,work);work.catch(()=>tileCache.delete(key));if(tileCache.size>100)tileCache.delete(tileCache.keys().next().value);
   }const image=await tileCache.get(key);if(current===generation)send(m.id,image);
  }catch(err){if(current===generation)send(m.id,null,err.message)}return
 }
 if(m.type==='analysis'){
  const allowed=active==='sentiment'?'sentiment':active==='family'?'family':['movies','trains'].includes(active)?'overview':null;
  if(m.kind!==allowed||!Array.isArray(m.rows)||m.rows.length>100){send(m.id,null,'摘要任务不被允许');return}
  if(analysisBusy){send(m.id,null,'当前摘要仍在生成');return}
  const controller=new AbortController();controllers.set(m.id,controller);analysisBusy=true;
  try{const input=insightRequest(m.kind,m.rows,m.prefs);trace('analysis-start',{kind:m.kind,input,id:m.id});
   const raw=demo?insightFixture(m.kind,m.rows):await invokeTool('glm.generate',input,{signal:controller.signal,sessionId,pageId:`h5-${active}-${current}`});
   if(current!==generation)return;trace('analysis-output',{id:m.id,result:raw});const result=validateInsight(m.kind,raw,m.rows);
   if(current===generation&&!controller.signal.aborted){trace('analysis-result',{kind:m.kind,id:m.id,result});send(m.id,result)}
   else if(current===generation)send(m.id,null,'摘要已取消');
  }catch(err){if(current===generation){trace('analysis-error',{id:m.id,message:err.message});send(m.id,null,err.message)}}
  finally{if(current===generation){controllers.delete(m.id);analysisBusy=false}}return
 }
 if(m.type==='open'){const u=canonicalUrl(m.url);if(knownUrls.has(u)){openLink(u);trace('open-source',{url:u})}else notice('来源链接未通过工具结果验证');return}
 if(m.type!=='tool'||!ALLOWED[active].includes(m.tool)||typeof m.id!=='string'||m.id.length>80)return;
 const key=m.tool+JSON.stringify(m.input),existing=pendingKeys.get(key);if(existing){existing.push(m.id);return}if(controllers.size>=2){send(m.id,null,'请等待当前查询完成');return}
 const controller=new AbortController(),ids=[m.id];controllers.set(m.id,controller);pendingKeys.set(key,ids);trace('tool-start',{tool:m.tool,input:m.input,id:m.id,mode:demo?'fixture':'live'});
 try{const result=demo?fixture(m.tool,m.input):await invokeTool(m.tool,m.input,{signal:controller.signal,sessionId,pageId:`h5-${active}-${current}`});if(current!==generation)return;remember(result);trace('tool-result',{tool:m.tool,id:m.id,result});ids.forEach(id=>send(id,result));}
 catch(err){if(current!==generation)return;trace('tool-error',{tool:m.tool,id:m.id,message:err.message,errorInfo:err.errorInfo});ids.forEach(id=>send(id,null,controller.signal.aborted?'已取消，保留原内容':err.message));}
 finally{if(current===generation){controllers.delete(m.id);pendingKeys.delete(key)}}
});
function exportData(data,name){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function boot(){const manifest=await(await fetch('./manifest.json')).json();version=manifest.version;[bundle,css]=await Promise.all([fetch('./'+manifest.script).then(r=>r.text()),fetch('./'+manifest.css).then(r=>r.text())]);
 $('#cases').innerHTML=CASES.map(([id,n,label])=>`<button data-case="${id}"><small>${n}</small>${label}</button>`).join('');$('#cases').onclick=e=>{const b=e.target.closest('[data-case]');if(b){active=b.dataset.case;mount()}};
 $('#width').value=width;$('#size').value=size;$('#width').onchange=e=>{width=+e.target.value;mount()};$('#size').onchange=e=>{size=e.target.value;mount()};
 $('#feedback').oninput=e=>store(saveKey+':feedback',{note:e.target.value,at:new Date().toISOString(),version,caseId:active});
 $('#export').onclick=()=>exportData({version,caseId:active,mode:demo?'fixture':'live',state:currentState,events,feedback:load(saveKey+':feedback')},`baseline-${active}-${version}.json`);
 $('#switch-mode').href=demo?'?case='+active:'?case='+active+'&fixtures=1';await mount();}
boot().catch(e=>notice('工作台加载失败：'+e.message));
window.addEventListener('pagehide',()=>controllers.forEach(c=>c.abort()));
