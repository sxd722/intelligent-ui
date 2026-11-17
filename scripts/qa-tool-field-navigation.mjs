import {mkdir,writeFile,readFile,appendFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const root='artifacts/tool-field-navigation',base='http://127.0.0.1:8787'
await mkdir(root,{recursive:true})
const cases={
 game:JSON.parse(await readFile('artifacts/refine-background-20261111/game.json','utf8')).result.prompt,
 news:'做一张科技新闻阅读卡，真实获取 Hacker News 当前热门新闻。用最低得分滑块筛选完整返回集合，清楚显示筛选数量；选择一条展开信息，能打开它的原文，返回后保留筛选。不要编造摘要或评论数据。尽量用原生 CardSpec，一张自然高度卡。',
 weather:'用真实天气工具做杭州和上海未来几天的天气比较卡。城市切换真正改变预报；选择一天显示当天温度和天气，按有雨/全部筛选，不能把缺失气温当成零。提供真实来源链接；清除筛选和刷新后仍能继续选择。用一张原生 CardSpec，自然高度。'
}
const chosen=process.argv.slice(2)
if(chosen.includes('probe')){
 const sources={broken:'<card><state id="selected" type="string" initial=""/><button label="打开原文" onPress="open"/><text>{state.selected}</text><action id="open"><set target="selected" value="selected"/></action></card>',link:'<card><title>新闻原文</title><link label="打开原文" url="https://example.org/article"/></card>'}
 for(const [id,source]of Object.entries(sources)){
  const {spec}=compileCard(source,{final:true})
  const result=await runDebugBrowser(spec,{steps:[{op:'click',name:'打开原文',expect:{navigation:'https://example.org/article'}}],scenarios:['normal'],viewports:[320,360,432],size:'auto',captureSteps:true,artifactDir:`${root}/probe-${id}`})
  await writeFile(`${root}/probe-${id}.json`,JSON.stringify(result,null,2));console.log(id,JSON.stringify(result.runs.map(r=>({width:r.width,actions:r.actions.map(a=>({ok:a.ok,assertion:a.assertion,navigation:a.observed?.navigation,error:a.error}))}))))
 }
}
for(const id of chosen.filter(id=>Object.hasOwn(cases,id))){
 const request={messages:[{role:'user',content:cases[id]}],format:'cardspec',mode:'direct',generationProfile:'adaptive-v1',expressionDialect:'js-v1',modelProfile:'deepseek-flash',toolsEnabled:true,designMode:'host',debugGeneration:true,buildMode:'quick',cardSize:'auto',renderMode:'native',turnId:randomUUID()}
 const started=Date.now(),events=[],apply=createDeltaApplier(),envelope={};let error
 await writeFile(`${root}/${id}-request.json`,JSON.stringify(request,null,2));await writeFile(`${root}/${id}.sse`,'')
 try{
  const response=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(request),signal:AbortSignal.timeout(420000)})
  if(!response.ok)throw Error('HTTP '+response.status)
  let pending='';const decoder=new TextDecoder()
  for await(const chunk of response.body){const str=decoder.decode(chunk,{stream:true});await appendFile(`${root}/${id}.sse`,str);pending+=str;let n;while((n=pending.indexOf('\n'))>=0){const line=pending.slice(0,n);pending=pending.slice(n+1);if(!line.startsWith('data:')||line.slice(5).trim()==='[DONE]')continue;const e=JSON.parse(line.slice(5));events.push(e);if(!isControlEvent(e))apply.apply(envelope,e);if(['research','stream_error','message_stream_complete'].includes(e.type))console.log(JSON.stringify({id,type:e.type,status:e.status,tool:e.tool,error:e.error}))}}
 }catch(e){error=e.message}
 const m=envelope.message||{},result={id,title:id+' · 字段与导航验收',prompt:cases[id],elapsedMs:Date.now()-started,error,status:events.findLast(e=>e.type==='message_stream_complete')?.status,source:m.metadata?.validated_source||m.content?.parts?.join('')||'',spec:m.metadata?.card_spec,metadata:m.metadata,events}
 await writeFile(`${root}/${id}.json`,JSON.stringify(result,null,2));await mkdir('public/tool-field-navigation/runs',{recursive:true});await mkdir('dist/tool-field-navigation/runs',{recursive:true});for(const folder of ['public','dist'])await writeFile(`${folder}/tool-field-navigation/runs/${id}.json`,JSON.stringify(result));console.log(JSON.stringify({id,status:result.status,seconds:result.elapsedMs/1000,bindings:Object.values(result.spec?.bindings||{}).map(b=>b.tool),error}))
}
