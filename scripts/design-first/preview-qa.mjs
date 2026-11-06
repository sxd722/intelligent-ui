import {chromium} from '@playwright/test';import fs from 'node:fs/promises';
const root='artifacts/design-first-20261103',run=JSON.parse(await fs.readFile(root+'/image-weekend.json')),spec=run.spec,mock=spec.context.designMock;
const b=await chromium.launch({channel:'chrome',headless:true}),results=[];
for(const mode of ['success','cancel','image-failure']){
 const ctx=await b.newContext({viewport:{width:620,height:900}});const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await ctx.tracing.start({screenshots:true,snapshots:true});
 await p.addInitScript(({spec,mock})=>{
  localStorage.setItem('cardspec-refine-prompt','off');const original=window.fetch.bind(window);
  window.fetch=(url,options)=>{if(String(url)!=='/api/chat')return original(url,options);
   const request=JSON.parse(options.body),turnId=request.turnId,id='preview-test';
   return Promise.resolve(new Response(new ReadableStream({start(controller){
    const emit=f=>controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify({...f,turnId})+'\n\n'));
    options.signal.addEventListener('abort',()=>controller.error(new DOMException('Stopped','AbortError')),{once:true});
    emit({type:'phase_begin',id,phase:'dsl',kind:'cardspec',title:'图片先行测试'});
    emit({p:'',o:'add',v:{message:{status:'running',metadata:{format:'cardspec'},content:{parts:['']}}}});
    emit({type:'design_mock',status:'ready',mock});
    window.previewPartial=()=>emit({p:'/message/metadata/card_spec',o:'add',v:spec});
    window.previewFinish=()=>{emit({p:'/message/metadata',o:'append',v:{card_spec:spec,core_ready:true}});emit({p:'/message/status',o:'replace',v:'succeeded'});emit({type:'phase_end',id,status:'succeeded'});emit({type:'message_stream_complete',status:'succeeded'});controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));controller.close()};
   }}),{headers:{'Content-Type':'text/event-stream'}}))
  }
 },{spec,mock});
 if(mode==='image-failure')await p.route('**/api/media/**',route=>route.abort());
 const r={mode};try{
 await p.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});await p.getByLabel('设计流程',{exact:true}).selectOption('image-first');await p.getByLabel('卡片生成需求').fill('预览验证');await p.getByRole('button',{name:'发送',exact:true}).click();await p.getByRole('region',{name:'设计图预览'}).waitFor();
 r.previewWidth=(await p.locator('.design-preview').boundingBox()).width;r.previewVisible=await p.locator('.design-preview').isVisible();r.thinking=await p.locator('.design-preview .thinking').isVisible();r.partialHidden=await p.locator('.cs-card').count()===0;
 await p.evaluate(()=>window.previewPartial());await p.waitForTimeout(200);r.partialStillHidden=await p.locator('.cs-card').count()===0;
 await p.locator('.design-preview').screenshot({path:root+'/screenshots/preview-'+mode+'.png'});
 if(mode==='cancel'){await p.getByRole('button',{name:'停止',exact:true}).click();await p.waitForTimeout(200);r.stopped=await p.locator('.design-preview').count()===0&&await p.locator('.thinking').count()===0}
 else{if(mode==='image-failure')r.errorPlaceholder=await p.getByText('设计图暂不可见',{exact:true}).isVisible();await p.evaluate(()=>window.previewFinish());await p.locator('.cs-card').waitFor();await p.waitForTimeout(400);r.replaced=await p.locator('.design-preview').count()===0;r.stableWidth=Math.abs((await p.locator('.cs-card').boundingBox()).width-r.previewWidth)<2;r.interactive=await p.locator('.cs-task-board').getByLabel('筛选候选入口').isVisible();await p.locator('.cs-task-board .tb-pick').first().click();r.selection=await p.locator('.cs-task-board').getByRole('button',{name:'已选 1',exact:true}).count()===1;await p.locator('.cs-card').screenshot({path:root+'/screenshots/preview-'+mode+'-complete.png'});await p.reload({waitUntil:'domcontentloaded'});await p.waitForTimeout(300);r.refreshNoPreview=await p.locator('.design-preview').count()===0}
 }catch(e){r.error=e.message}finally{r.pageErrors=errors;await ctx.tracing.stop({path:root+'/preview-'+mode+'-browser.zip'});await ctx.close()};results.push(r)
}
await b.close();await fs.writeFile(root+'/preview-qa.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));if(results.some(r=>r.error||r.pageErrors.length||Object.values(r).some(v=>v===false)))process.exitCode=1;
