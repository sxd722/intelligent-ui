import {chromium} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
const root='artifacts/native-baselines/live';await mkdir(root,{recursive:true});
const before=await(await fetch('http://127.0.0.1:8787/api/tools/connections')).json();
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
try{
 for(const id of ['sentiment','family','movies','trains']){
  const p=await browser.newPage({viewport:{width:900,height:1100}});p.setDefaultTimeout(8000);
  const events=[];p.on('pageerror',e=>events.push({type:'page-error',message:e.message}));
  const stored=()=>p.evaluate(id=>JSON.parse(sessionStorage.getItem('native-baseline-v1:'+id+':live')||'null'),id);
  const state=async()=>Object.values((await stored())?.pages?.[0]?.viewState?.components||{}).find(v=>v.logic)?.logic?.state;
  const wait=async fn=>{for(let i=0;i<1000;i++){const s=await state();if(s&&fn(s))return s;await p.waitForTimeout(100);}throw Error('100s deadline');};
  try{
   await p.goto('http://127.0.0.1:8787/cardspec-baselines.html?mode=live&case='+id);await p.getByLabel('卡片尺寸',{exact:true}).selectOption('auto');await wait(s=>s.seen===0);
   const c=p.locator('.cs-card'),tab=async label=>{await c.getByRole('radiogroup',{name:'当前视图',exact:true}).getByRole('radio',{name:label,exact:true}).click();await wait(s=>s.tab===label);};
   async function invoke(label,op){
    const seq=(await state()).seen,start=Date.now();await c.getByRole('button',{name:label,exact:true}).click();await wait(s=>s.seen>seq);await p.waitForTimeout(200);
    const snapshot=await stored(),b=snapshot.pages[0].bindings[op],s=await state();const record={label,op,status:b?.status,error:b?.error,elapsedMs:Date.now()-start,count:b?.value?.items?.length,message:s.message};events.push(record);console.log(id,JSON.stringify(record));return b?.status==='success';
   }
   if(id==='sentiment'){
    await tab('取数');await invoke('搜索新闻','news');if(await invoke('搜索 B站','videos')){
     await tab('社交线索');if(await c.locator('.cs-collection-item').count()){await c.locator('.cs-collection-item').first().click();await wait(s=>s.focus);if((await state()).focus.bvid)await invoke('获取这条视频的评论','comments');}
    }
    if((await state()).total){await tab('态度概览');await invoke('分析样本态度','analyze');}
   }else if(id==='family'){
    if(await invoke('找亲子地点','search')){
     await tab('候选');for(let i=0;i<Math.min(2,(await state()).rows.length);i++){await c.locator('.cs-collection-item').nth(i).click();await wait(s=>s.focus?.rowKey===s.rows[i].rowKey);await c.getByRole('button',{name:'加入周末',exact:true}).click();await wait(s=>s.selected.length===i+1);}
     if((await state()).selected.length){await tab('两天计划');await invoke('按选中地点规划两天','plan');}
    }
   }else if(id==='movies'){
    if(await invoke('找电影','search')&&(await state()).rows.length){
     await c.locator('.cs-collection-item').first().click();await wait(s=>s.detail);
     await invoke('获取完整资料','detail');await c.getByRole('button',{name:'今晚就看它',exact:true}).click();await wait(s=>s.pick);await invoke('查 B站相关视频','videos');
    }
   }else{
    await tab('查找车次');if(await invoke('查询车次','search')&&(await state()).rows.length){await c.locator('.cs-collection-item').first().click();await wait(s=>s.candidate);await c.getByRole('button',{name:'固定此车次',exact:true}).click();await wait(s=>s.tickets[0]);}
   }
   await p.getByLabel('卡片尺寸',{exact:true}).selectOption('square');await p.waitForTimeout(350);await c.screenshot({path:root+'/'+id+'.png'});
   const images=await c.locator('img').evaluateAll(imgs=>imgs.map(i=>({src:i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0})));
   results.push({id,events,images,summary:(await state())?.message});
   await writeFile(root+'/'+id+'-session.json',JSON.stringify(await stored(),null,2));
  }catch(e){results.push({id,events,error:e.message});console.log(id,e.message);await p.screenshot({path:root+'/'+id+'-error.png'});await writeFile(root+'/'+id+'-session.json',JSON.stringify(await stored(),null,2));}
  await p.close();
 }
}finally{await browser.close();}
const after=await(await fetch('http://127.0.0.1:8787/api/tools/connections')).json();
const connection={before:{session:before.browser?.binding?.session,daemonPid:before.browser?.daemonPid},after:{session:after.browser?.binding?.session,daemonPid:after.browser?.daemonPid,connected:after.browser?.connected}};
await writeFile(root+'/results.json',JSON.stringify({results,connection},null,2));console.log(JSON.stringify(connection));
