import {chromium} from '@playwright/test'
import assert from 'node:assert/strict'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
const dir=process.env.NATIVE_QA_DIR||'artifacts/native-baselines/ui';await mkdir(dir,{recursive:true});
const demo=process.env.NATIVE_DEMO_QA==='1';
const url=process.env.NATIVE_QA_URL||'http://127.0.0.1:8787/cardspec-baselines.html';
const canonical=JSON.parse(await readFile('shared/cardspec/baselines/generated.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
const ids=(process.env.CASES||'sentiment,family,movies,trains,transformer').split(',');
const sizes=process.env.SMOKE?[[360,'square']]:[320,360,432].flatMap(w=>[[w,'square'],[w,'auto']]);
try{
 for(const id of ids)for(const [width,size]of sizes){
  const p=await browser.newPage({viewport:{width:Math.max(width+24,390),height:900}}),errors=[],requests=[];p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
  const state=()=>p.evaluate(id=>{const saved=JSON.parse(sessionStorage.getItem('native-baseline-v1:'+id+':fixture')||'null');return Object.values(saved?.pages?.[0]?.viewState?.components||{}).find(v=>v.logic)?.logic?.state;},id);
  const wait=async fn=>{for(let i=0;i<70;i++){const s=await state();if(s&&fn(s))return s;await p.waitForTimeout(100);}throw Error('State timeout: '+JSON.stringify(await state()).slice(0,500));};
  try{
   await p.goto(`${url}?case=${id}${demo?'&mode=live':''}`);await p.getByLabel('宽度',{exact:true}).selectOption(String(width));await p.getByLabel('卡片尺寸',{exact:true}).selectOption(size);
   if(demo){assert.equal(await p.getByLabel('数据模式',{exact:true}).count(),0);assert.ok(await p.getByText('可互动演示 · 不连接 OpenCLI / GLM · 反馈仅保存于此浏览器',{exact:true}).isVisible());}
   const c=p.locator('.cs-card'),click=label=>c.getByRole('button',{name:label,exact:true}).click(),tab=async label=>{await c.getByRole('radiogroup',{name:'当前视图',exact:true}).getByRole('radio',{name:label,exact:true}).click();await wait(s=>s.tab===label);};
   await wait(s=>s.seen===0);
   assert.equal(await p.locator('aside details pre').first().textContent(),canonical.find(x=>x.id===id).source,'UI must render the canonical downloadable DSL');
   assert.deepEqual(JSON.parse(await p.getByTestId('diagnostics').textContent()).filter(d=>d.severity==='error'),[]);
   if(id==='sentiment'){
    await tab('取数');await click('搜索新闻');await wait(s=>s.sources.news);await click('搜索微博');await wait(s=>s.total===3);await tab('态度概览');await click('分析样本态度');await wait(s=>s.labels.length===3);
    await c.getByRole('button',{name:'负向 1',exact:true}).click();await wait(s=>s.tab==='原文'&&s.rows.length===1);await c.locator('.cs-collection-item').first().click();await wait(s=>s.focus?.quote);if(!demo)assert.equal(await c.getByRole('link',{name:'打开所选来源 ↗'}).getAttribute('href'),'https://example.com/comment/0');else assert.equal(await c.getByRole('link',{name:'打开所选来源 ↗'}).count(),0);
    await tab('时间走势');await c.getByRole('button',{name:'2026-10-18 负向 1',exact:true}).click();await wait(s=>s.date==='2026-10-18');await tab('态度概览');
   }else if(id==='family'){
    await click('找亲子地点');await wait(s=>s.rows.length===4);
    await c.getByRole('button',{name:'测试 · 湖畔公园',exact:true}).click();await click('加入周末');await wait(s=>s.selected.length===1);
    await c.getByRole('button',{name:'测试 · 自然博物馆',exact:true}).click();await click('加入周末');await wait(s=>s.selected.length===2);
    await tab('两天计划');await click('按选中地点规划两天');await wait(s=>s.plan?.slots.length===2);await tab('准备');await c.getByRole('checkbox',{name:'水和点心',exact:true}).click();await wait(s=>s.packed['水和点心']);assert.equal(await c.getByRole('checkbox',{name:'水和点心',exact:true}).isChecked(),true);await tab('两天计划');
   }else if(id==='movies'){
    await click('找电影');await wait(s=>s.rows.length===7);await c.locator('.cs-collection-item').first().click();await wait(s=>s.detail);await click('获取完整资料');await wait(s=>s.detail.summary);await click('加入 / 移出比较');await wait(s=>s.chosen.length===1);await click('今晚就看它');await wait(s=>s.pick);await click('查 B站相关视频');await wait(s=>s.videos.length===1);
    await tab('发现');await click('正在热映');await wait(s=>s.pending==='');assert.ok((await state()).pick);await tab('去观看');
   }else if(id==='trains'){
    for(const leg of [0,1]){
     await tab('查找车次');await c.getByRole('radiogroup',{name:'去返程',exact:true}).getByRole('radio',{name:leg?'返程':'去程',exact:true}).click();await click('查询车次');await wait(s=>s.results[leg]);await c.locator('.cs-collection-item').nth(leg).click();await wait(s=>s.candidate);await click('固定此车次');await wait(s=>s.tickets[leg]);
    }
    await c.getByRole('button',{name:'管理提醒与余票',exact:true}).first().click();await c.getByLabel('核实的起售时间（北京时间）',{exact:true}).fill('2026-11-01T12:00');await wait(s=>s.release[0]==='2026-11-01T12:00');await click('刷新原车次余票');await wait(s=>s.message==='仅更新原车次余票');await tab('双程票夹');assert.equal(await c.getByRole('link',{name:'12306 官方购票 ↗'}).getAttribute('href'),'https://kyfw.12306.cn/otn/leftTicket/init');
   }else{
    await wait(s=>s.all.length===3);const before=(await state()).output;
    await tab('输入设置');await c.getByRole('slider').fill('1');await c.getByRole('slider').dispatchEvent('input');await wait(s=>s.delta===1);assert.notEqual((await state()).output,before);
    await c.getByRole('switch',{name:'启用两条残差连接'}).click();await wait(s=>s.residual===false);await tab('FFN显微镜');await c.getByRole('button',{name:/喜欢 \/ h3：/}).click();await wait(s=>s.neuron===2&&s.token===1);await tab('数值流');await c.getByRole('radiogroup',{name:'计算步骤',exact:true}).getByRole('radio',{name:'输出',exact:true}).click();await wait(s=>s.step===5);
   }
   const prior=await state();await p.reload();await p.getByLabel('宽度',{exact:true}).selectOption(String(width));const restored=await wait(s=>s.tab===prior.tab&&s.seen===prior.seen);
   for(const k of ['selected','pick','tickets','release','labels','packed','residual','delta'])if(k in prior)assert.deepEqual(restored[k],prior[k],id+' restore '+k);
   await p.waitForTimeout(250);await c.locator('.cs-logic[aria-busy=false]').waitFor();assert.equal(await c.locator('[role=alert]').count(),0);assert.deepEqual(errors,[]);
   const box=await c.evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth,height:el.clientHeight,scrollHeight:el.scrollHeight,regionHeight:el.querySelector('.cs-logic>.cs-region>.cs-region-body')?.clientHeight,emergency:el.dataset.emergency}));
   assert.ok(box.scrollWidth<=box.width+1,JSON.stringify(box));if(size==='square'){assert.ok(box.regionHeight>=90,'collapsed content '+JSON.stringify(box));assert.equal(box.emergency,'false');}
   await p.locator('.cs-stage').screenshot({path:`${dir}/${id}-${width}-${size}.png`});
   const saved=await p.evaluate(()=>Object.fromEntries(Object.entries(sessionStorage)));await writeFile(`${dir}/${id}-${width}-${size}-session.json`,JSON.stringify(saved,null,2));
   if(demo){
    assert.deepEqual(requests.filter(x=>new URL(x).pathname.startsWith('/api/')),[],'No API requests');
    assert.deepEqual(requests.filter(x=>/^https?:/.test(x)&&new URL(x).origin!==new URL(url).origin),[],'No external network');
    const denied=await p.evaluate(async()=>{try{await fetch('/api/tools/invoke',{method:'POST'});return false}catch{return true}});
    assert.ok(denied,'CSP must deny a direct API bypass');
   }
   results.push({id,width,size,artifactHash:canonical.find(x=>x.id===id).sha256,passed:true,box,demo,checks:['canonical-source','interaction','restore','no-pageerror','no-horizontal-overflow','content-space',...(demo?['no-api-or-external-network','CSP-blocks-api','live-param-ignored']:[])]});
  }catch(e){results.push({id,width,size,passed:false,error:e.message,errors,state:await state()});await p.screenshot({path:`${dir}/error-${id}-${width}-${size}.png`});}
  await p.close();console.log(JSON.stringify({...results.at(-1),state:undefined}));
 }
}finally{await browser.close();}
await writeFile(dir+'/results.json',JSON.stringify(results,null,2));if(results.some(x=>!x.passed))process.exitCode=1;
