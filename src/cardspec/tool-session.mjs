import {followupEntries} from '../../shared/cardspec/followups.mjs'
import {canonicalInput,prefetchedInvocation} from '../../shared/cardspec/prefetch.mjs'
import { normalizeCardSize } from '../../shared/cardspec/generation-layout.mjs'
import { conversationEpoch } from './session-storage.mjs'
import { createStore,makeScope,executeAction } from '../../shared/cardspec/store.mjs'
import { evaluate } from '../../shared/cardspec/expression.mjs'
import { TOOLS,validateToolInput,validateJson } from '../../shared/cardspec/tools.mjs'
import { toolErrorInfo } from '../../shared/cardspec/tool-errors.mjs'
import { entityKey, resultContext, detailRequests } from '../../shared/cardspec/result-view.mjs'
import {bindingDependencies,validateBusinessIds} from '../../shared/cardspec/dataflow.mjs'
import {evidenceRequests,boundedEvidence} from '../../shared/cardspec/tool-evidence.mjs'
export async function toolTransport(payload,signal,onProgress){
  const cloud=typeof import.meta.env!=='undefined'&&(import.meta.env.VITE_CLOUD_NO_TOOLS==='1'||import.meta.env.VITE_CLOUD_DEMO_TOOLS==='1')
  const endpoint=cloud&&payload.tool==='glm.generate'&&payload.target?.startsWith('sandbox:')?'/api/sandbox/generate':'/api/tools/invoke'
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal})
  if(!response.ok||!response.body)throw new Error(`工具服务 HTTP ${response.status}`)
  let buffer='',result,done=false,error;const decoder=new TextDecoder()
  // Safari can expose getReader() without ReadableStream async iteration.
  const reader=response.body.getReader();let ended=false
  try{while(true){
    const {value:bytes,done:streamDone}=await reader.read()
    if(streamDone){ended=true;break}
    buffer+=decoder.decode(bytes,{stream:true});let boundary
    while((boundary=/\r?\n\r?\n/.exec(buffer))){
      const block=buffer.slice(0,boundary.index);buffer=buffer.slice(boundary.index+boundary[0].length)
      for(const line of block.split('\n'))if(line.startsWith('data:')){
        const event=JSON.parse(line.slice(5));if(event.requestId!==payload.requestId||event.pageId!==payload.pageId)throw new Error('工具响应标识不匹配')
        if(event.type==='result')result=event.result
        if(event.type==='error')error=Object.assign(new Error(event.error),{errorInfo:event.errorInfo})
        if(event.type==='done')done=true
        onProgress?.(event)
      }
    }
  }}finally{
    // Stop consuming on parse/identity/progress errors, and always release the lock.
    if(!ended)try{await reader.cancel()}catch{}
    reader.releaseLock()
  }
  if(error)throw error
  if(!done||!result)throw new Error('工具连接提前结束')
  return result
}
const clone=x=>structuredClone(x)
const key=x=>JSON.stringify(x)
export function newPage(spec,resources={}){
  const store=createStore();makeScope(spec,store)
  const page={id:spec.cardId,spec,store,bindings:{},slots:{},resources,viewState:{},error:''};seedPrefetched(page);return page
}
export function seedPrefetched(page){
 const definitions=Object.entries(page.spec.bindings||{})
 // A dependent declaration can precede its source binding. Reach a bounded
 // fixed point using only saved results; this never invokes tools or effects.
 for(let pass=0;pass<definitions.length;pass++){
 let changed=false
 for(const [id,def] of definitions){
  if(page.bindings[id]?.updatedAt||page.bindings[id]?.status==='loading')continue
  try{const input=evaluate(def.input,makeScope(page.spec,page.store,{bindings:page.bindings})),match=page.spec.prefetched?.find(r=>{const invocation=prefetchedInvocation(r,page.spec.prefetched);return invocation?.tool===def.tool&&canonicalInput(invocation.input)===canonicalInput(input)})
   if(match){page.bindings[id]={value:clone(match.value),valueInputKey:canonicalInput(input),status:'success',error:'',updatedAt:match.updatedAt,inputKey:key(input),definitionKey:key(input),dependencyKey:'{}',version:1,target:'binding'};changed=true}
  }catch{}
 }
 if(!changed)break
 }
}
export function createCardSession(spec,{transport=toolTransport,getRenderMode=()=> 'native',getCardSize=()=>spec.context?.cardSize,authorizeWrite=async()=>{throw new Error('写操作需要宿主确认')},storage=null,persistenceKey=null,now=()=>Date.now(),id=()=>crypto.randomUUID()}={}){
  const storageEpoch=conversationEpoch(storage)
  let pages=[newPage(spec)],index=0,version=0,epoch=0,enabled=true,visible=false,complete=false,disposed=false,glm=null,persistTimer
  const listeners=new Set(),running=new Map()
  let notice='',storageError='',favorites={},media={}
  if(storage&&persistenceKey)try{
    const saved=JSON.parse(storage.getItem(persistenceKey)||'null')
    if(saved?.version===1&&saved.rootId===spec.cardId&&Array.isArray(saved.pages)&&saved.pages.length&&saved.pages.length<=20&&Number.isInteger(saved.index)&&saved.index>=0&&saved.index<saved.pages.length){
      pages=saved.pages;index=saved.index;favorites=saved.favorites||{};media=saved.media||{}
      for(const p of pages)if(p.resultView?.loading){p.resultView.loading=false;p.resultView.error='上次详情请求已中断'}
      for(const p of pages)for(const b of Object.values(p.bindings||{}))if(b.status==='error'&&!b.errorInfo)b.errorInfo=toolErrorInfo(new Error(b.error||'工具执行失败'),{now:now()})
      for(const p of pages){makeScope(p.spec,p.store,{bindings:p.bindings});p.error='';for(const b of Object.values(p.bindings))if(b.status==='loading'){b.status='cancelled';b.error=b.writeSubmitted?'外部操作结果未知，请到原站点核对，不能直接重试':'上次请求已中断';b.blockedRetry=!!b.writeSubmitted} }
    }
  }catch{storageError='页面历史无法恢复，已打开原始卡片'}
  const current=()=>pages[index]
  function persist(){
    if(!storage||!persistenceKey||conversationEpoch(storage)!==storageEpoch)return
    try{storage.setItem(persistenceKey,JSON.stringify({version:1,rootId:pages[0].rootId||spec.cardId,index,pages,favorites,media}));storageError=''}catch{storageError='存储空间不足，本次内容仍可使用，但刷新后可能无法恢复'}
  }
  function emit(){version++;for(const fn of listeners)fn();clearTimeout(persistTimer);persistTimer=setTimeout(persist,80)}
  function scope(page=current(),extra={}){return makeScope(page.spec,page.store,{...extra,bindings:page.bindings})}
  function record(page,binding){
    if(!page.bindings[binding])page.bindings[binding]={...scope(page).bindings[binding],inputKey:null,target:'binding'}
    return page.bindings[binding]
  }
  function cancelAll(){epoch++;for(const r of running.values())r.controller.abort();running.clear();glm=null;for(const p of pages)for(const b of Object.values(p.bindings))if(b.status==='loading'){b.status='cancelled';b.error=b.writeSubmitted?'已停止等待；外部操作可能继续，请到原站点核对':'已中断';b.blockedRetry=!!b.writeSubmitted}}
  function fire(action,extra={},cause='user',depth=0,page=current()){
    const effects=[],before=key(page.store.values)
    assertSourcesCurrent(extra.sourceLeases,page)
    executeAction(page.spec,page.store,action,{...extra,bindings:page.bindings,effects})
    // Observed effects, not a semantic quality score. Retain no arguments or
    // user input and never invoke an extra model for diagnostics.
    page.experienceActivity={...page.experienceActivity,actions:[...(page.experienceActivity?.actions||[]),{action,cause,stateChanged:before!==key(page.store.values),effects:effects.length,at:now()}].slice(-24)}
    page.error='';emit()
    for(const effect of effects)void invoke(effect,{extra,cause,depth,page})
  }
  function inputFor(page,binding,extra={}){return evaluate(page.spec.bindings[binding].input,scope(page,extra))}
  function sourceLeases(ids,page=current()){
    return [...new Set(ids||[])].filter(id=>page.spec.bindings[id]).map(binding=>({binding,version:page.bindings[binding]?.version||0}))
  }
  function assertSourcesCurrent(leases=[],page=current()){
    for(const lease of leases){
      const b=page.bindings[lease.binding]
      if(!b?.updatedAt||(b.version||0)!==lease.version||b.definitionKey!==key(inputFor(page,lease.binding)))
        throw Object.assign(Error('查询条件或结果已改变，请重新查询后再操作此结果；已固定的选择保持不变。'),{code:'STALE_RESULT'})
    }
  }
  function dependencySnapshot(page,binding,expression,seen=new Set()){
    const snapshot={}
    for(const dep of bindingDependencies(page.spec,binding,expression)){
      const b=page.bindings[dep]
      if(seen.has(dep)||!b||b.status!=='success'||!b.updatedAt||b.definitionKey!==key(inputFor(page,dep)))
        throw Object.assign(new Error(`所需数据 ${dep} 尚未成功获取，或其查询条件已经改变；请先获取对应数据再重试。`),{code:'DEPENDENCY_NOT_READY'})
      Object.assign(snapshot,dependencySnapshot(page,dep,undefined,new Set([...seen,dep])))
      snapshot[dep]={version:b.version||0,inputKey:b.inputKey,updatedAt:b.updatedAt}
    }
    return snapshot
  }
  async function invoke(effect,{extra={},cause='user',depth=0,page=current()}={}){
    if(!enabled||!complete){page.error=enabled?'卡片生成完成后才能调用工具':'工具增强已关闭';emit();return}
    if(depth>=3){page.error='工具调用链已达到三次上限';emit();return}
    const definition=page.spec.bindings?.[effect.binding]
    if(!definition){page.error='未知工具绑定';emit();return}
    const target=effect.target||'binding',tool=definition.tool
    const write=TOOLS[tool]?.readOnly===false
    if(write&&(cause!=='user'||depth!==0)){page.error='外部修改只能由独立的用户操作触发，不能自动调用或串联';emit();return}
    if(write&&page.bindings[effect.binding]?.blockedRetry){page.error='上次外部操作可能已生效，请先核对原站点，再允许新操作';emit();return}
    if(['glm.generate','dataset.analyze'].includes(tool)&&cause!=='user'){page.error='生成需要用户操作';emit();return}
    let input,dependencies
    const readInput=()=>effect.inputExpression?evaluate(effect.inputExpression,scope(page,extra)):inputFor(page,effect.binding,extra)
    try{
      dependencies=dependencySnapshot(page,effect.binding,effect.inputExpression)
      input=clone(effect.input??readInput());validateToolInput(tool,input)
      if(tool.startsWith('opencli.'))validateBusinessIds(input,page.bindings)
    }catch(e){const b=record(page,effect.binding);Object.assign(b,{status:'error',error:e.message,errorInfo:toolErrorInfo(Object.assign(e,{code:e.code||'INVALID_INPUT'}),{now:now()}),inputKey:input?key(input):null,attemptAt:now()});page.error=e.message;emit();return}
    const requestKey=`${page.id}:${effect.binding}`,signature=key(input),old=running.get(requestKey)
    if(old&&old.signature===signature&&old.target===target&&old.dependencyKey===key(dependencies))return old.promise
    if(write&&[...running.values()].some(r=>r.write)){page.error='当前卡片已有外部操作待确认或执行，请先处理';emit();return}
    if(['glm.generate','dataset.analyze'].includes(tool)&&glm&&glm!==requestKey){page.error='当前卡片正在生成，请先等待或取消';emit();return}
    if(tool==='glm.generate')for(const [key,r] of running)if(r.cause==='auto'){
      r.controller.abort();running.delete(key)
      const previous=page.bindings[r.binding];if(previous)Object.assign(previous,{status:previous.updatedAt?'success':'idle',error:''})
    }
    old?.controller.abort()
    const controller=new AbortController(),requestId=id(),activation=epoch
    const task={controller,signature,dependencyKey:key(dependencies),target,promise:null,cause,binding:effect.binding,write};running.set(requestKey,task)
    if(['glm.generate','dataset.analyze'].includes(tool))glm=requestKey
    const b=record(page,effect.binding);Object.assign(b,{errorCount:cause==='user'||b.inputKey!==signature?0:b.errorCount||0,status:'loading',progress:'',error:'',errorInfo:null,inputKey:signature,target,paused:false,writeSubmitted:false,blockedRetry:false});page.error='';emit()
    const retryExtra=Object.fromEntries(Object.entries(extra).filter(([k])=>!['state','next','data','derived','context','bindings','effects'].includes(k)))
    b.retry={binding:effect.binding,target,input:clone(input),inputExpression:effect.inputExpression,onSuccess:effect.onSuccess,onError:effect.onError,extra:clone(retryExtra)}
    const definitionKey=key(inputFor(page,effect.binding,extra))
    // Effects already captured action-entry input before the local commit.
    // Watch the post-commit input for subsequent edits, not against that older
    // payload: clearing a form as part of submit must not cancel its own result.
    const watchInputKey=key(readInput())
    b.retry.watchInputKey=watchInputKey
    const evidenceLeases=[]
    const valid=()=>{try{return !disposed&&!controller.signal.aborted&&activation===epoch&&current()===page&&running.get(requestKey)===task&&(write&&b.writeSubmitted||key(readInput())===watchInputKey&&key(dependencySnapshot(page,effect.binding,effect.inputExpression))===key(dependencies)&&evidenceLeases.every(e=>page.bindings[e.binding]?.status==='success'&&page.bindings[e.binding]?.version===e.version&&page.bindings[e.binding]?.definitionKey===key(inputFor(page,e.binding))))}catch{return false}}
    const release=()=>{if(running.get(requestKey)===task){running.delete(requestKey);if(glm===requestKey)glm=null}}
    task.promise=(async()=>{
      try{
        const payload={tool,input,target,requestId,pageId:page.id,sessionId:spec.cardId,cause,view:{designPreference:page.spec.context?.designPreference,debugGeneration:page.spec.context?.debugGeneration,expressionDialect:page.spec.context?.expressionDialect,modelProfile:page.spec.context?.modelProfile,generationProfile:page.spec.context?.generationProfile,renderMode:getRenderMode(),generationMode:page.spec.context?.generationMode,cardSize:normalizeCardSize(getCardSize()),goal:spec.context?.userGoal||'',summary:(page.spec.intro||page.spec.children.filter(n=>n.type==='title').flatMap(n=>n.children.filter(c=>c.type==='run'&&c.value.type==='literal').map(c=>c.value.value)).join(' ')).slice(0,1000),width:page.viewState.width||432,height:page.viewState.height||432}}
        // A generated page/slot is the answer to this explicit user action,
        // not a new entry screen asking the user to request the answer again.
        if(tool==='glm.generate'&&(target==='page'||target.startsWith('slot:')))payload.view.taskPhase='result'
        if(write){
          payload.confirmationToken=await authorizeWrite(payload,controller.signal)
          if(!valid())return
          if(!payload.confirmationToken)throw new Error('操作未确认')
          b.writeSubmitted=true;emit()
        }
        if(tool==='glm.generate'){
          const evidence=[]
          for(const request of evidenceRequests(input.context,page.spec,page.bindings)){
            if(!valid())return
            const origin=page.bindings[request.binding]
            if(origin.definitionKey!==key(inputFor(page,request.binding)))throw Object.assign(new Error('选中条目的来源查询已改变，请重新获取并选择'),{code:'DEPENDENCY_NOT_READY'})
            const sourceVersion=origin.version
            evidenceLeases.push({binding:request.binding,version:sourceVersion})
            validateToolInput(request.tool,request.input)
            // User-triggered factual reads share this request's cancellation and
            // page lease. No write relations, automatic GLM or guessed URLs.
            if(TOOLS[request.tool]?.readOnly!==true)throw new Error('详情关系必须是只读工具')
            const cached=Object.entries(page.bindings).find(([id,v])=>page.spec.bindings[id]?.tool===request.tool&&v.status==='success'&&v.inputKey===key(request.input)&&v.definitionKey===key(inputFor(page,id)))?.[1]
            const facts=cached?{kind:'json',value:cached.value}:await transport({tool:request.tool,input:request.input,target:'binding',requestId:id(),pageId:page.id,sessionId:spec.cardId,cause:'user'},controller.signal)
            if(!valid()||origin.status!=='success'||origin.version!==sourceVersion||origin.definitionKey!==key(inputFor(page,request.binding)))return
            if(facts.kind!=='json')throw new Error('详情工具没有返回数据')
            validateJson(facts.value,TOOLS[request.tool].outputSchema)
            evidence.push(boundedEvidence(request.tool,facts.value))
          }
          if(evidence.length){payload.input={...input,context:{...input.context,toolEvidence:evidence}};validateToolInput(tool,payload.input)}
        }
        payload.view.renderMode=getRenderMode()
        const result=await transport(payload,controller.signal,event=>{if(!valid())return;if(event.type==='experience'){b.progress=event.status==='planning'?'正在组织体验':'正在生成卡片';emit()}else if(event.type==='research'){b.progress=event.status==='running'?'正在核实资料':'正在生成卡片';emit()}})
        if(!valid())return
        const previous=clone(b),responseEffects=[],responseEvent={result:result.kind==='json'?result.value:result.spec,input,error:''}
        if(result.kind==='json')validateJson(result.value,tool==='glm.generate'?input.schema:TOOLS[tool].outputSchema)
        else if(!(result.kind==='slot'&&target.startsWith('slot:')||result.kind==='page'&&target==='page'))throw new Error('工具结果与目标不匹配')
        Object.assign(b,{...(result.kind==='json'?{value:clone(result.value),valueInputKey:canonicalInput(input)}:{}),status:'success',error:'',errorCount:0,updatedAt:new Date(now()).toISOString(),definitionKey,dependencyKey:key(dependencies),version:(b.version||0)+1})
        try{if(effect.onSuccess)executeAction(page.spec,page.store,effect.onSuccess,{bindings:page.bindings,event:responseEvent,effects:responseEffects})}
        catch(e){Object.assign(b,previous,{valueInputKey:previous.valueInputKey});throw e}
        if(result.kind==='json'){
          // Value and callback writes have committed as one response transaction.
        }else if(result.kind==='slot'&&target.startsWith('slot:')){
          page.slots[target.slice(5)]=newPage(result.spec,result.resources)
        }else if(result.kind==='page'&&target==='page'){
          cancelAll();pages=pages.slice(0,index+1);pages.push(newPage(result.spec,result.resources));index=pages.length-1
          if(pages.length>20){pages.shift();index--;notice='已保留最近 20 页'}
        }else throw new Error('工具结果与目标不匹配')
        release();emit()
        // Leaving a page cancels its callback chain, just like a user navigation.
        if(current()===page)for(const nextEffect of responseEffects)void invoke(nextEffect,{extra:{event:responseEvent},cause,depth:depth+1,page})
      }catch(e){
        if(!valid())return
        const errorInfo=toolErrorInfo(e,{now:now()})
        Object.assign(b,{status:'error',error:e.message,errorInfo,errorCount:(b.errorCount||0)+1,blockedRetry:write&&b.writeSubmitted});page.error=e.message
        release()
        try{if(effect.onError)fire(effect.onError,{event:{result:null,input,error:e.message,errorInfo}},cause,depth+1,page)}catch(callbackError){page.error=callbackError.message}
        emit()
      }finally{
        if(running.get(requestKey)===task){running.delete(requestKey);if(glm===requestKey)glm=null;if(b.status==='loading'){b.status='cancelled';b.error='输入或页面已改变，结果未应用'}emit()}
      }
    })()
    return task.promise
  }
  function tick(){
    if(!enabled||!visible||!complete||disposed||glm)return
    const page=current()
    for(const [binding,def] of Object.entries(page.spec.bindings||{})){
      if(['glm.generate','dataset.analyze'].includes(def.tool)||TOOLS[def.tool]?.readOnly===false||def.load!=='visible')continue
      let signature,dependencyKey
      try{signature=key(inputFor(page,binding));dependencyKey=key(dependencySnapshot(page,binding))}catch{continue}
      const b=record(page,binding),r=running.get(`${page.id}:${binding}`)
      if(r){if(r.signature!==signature||r.dependencyKey!==dependencyKey)void invoke({binding},{cause:'auto'});continue}
      const changed=b.inputKey!==signature||(b.status==='success'&&b.dependencyKey!==dependencyKey),age=b.updatedAt?now()-Date.parse(b.updatedAt):Infinity
      if(!changed&&b.status==='error'&&b.errorInfo&&(!b.errorInfo.retryable||b.errorCount>=2||b.errorInfo.retryAt>now()))continue
      if(b.paused&&!changed)continue
      // Errors retry on an explicit click or on the declared polling cadence.
      if(changed||b.status==='idle'||b.status==='cancelled'||(def.refresh&&age>=def.refresh*1000&&now()-(b.attemptAt||0)>=def.refresh*1000)){
        b.attemptAt=now();void invoke({binding},{cause:'auto'})
      }
    }
  }
  function push(page){cancelAll();pages=pages.slice(0,index+1);pages.push(page);index=pages.length-1;if(pages.length>20){pages.shift();index--;notice='已保留最近 20 页'}emit()}
  function openResults(binding){
    const page=current(),b=page.bindings[binding],tool=page.spec.bindings[binding]?.tool
    if(!tool||!b?.updatedAt||!Array.isArray(b.value?.items))return
    const result=newPage({...page.spec,cardId:id(),bindings:{},actions:{},state:{},derived:{},data:{},children:[]},page.resources)
    result.resultView={tool,value:clone(b.value)};push(result)
  }
  function openDetail(row){const page=current();if(!page.resultView)return;const next=newPage({...page.spec,cardId:id()},page.resources);next.resultView={...clone(page.resultView),row:clone(row)};push(next);void loadDetails()}
  async function loadDetails(){
    const page=current(),view=page.resultView
    if(!enabled||!visible||!complete||!view?.row||view.loading||glm)return
    const requests=detailRequests(view.tool,view.row);if(!requests.length)return
    const controller=new AbortController(),activation=epoch,requestKey='host-detail'
    running.set(requestKey,{controller,cause:'user'});view.loading=true;view.error='';emit()
    try{
      for(const request of requests){
        validateToolInput(request.tool,request.input)
        const result=await transport({...request,target:'binding',requestId:id(),pageId:page.id,sessionId:spec.cardId,cause:'user'},controller.signal)
        if(controller.signal.aborted||epoch!==activation||current()!==page)return
        if(result.kind!=='json')throw new Error('详情工具结果不是数据')
        validateJson(result.value,TOOLS[request.tool].outputSchema)
        if(request.kind==='facts')view.details=result.value
        else if(result.value.items[0]){if(Object.keys(media).length>=100)delete media[Object.keys(media)[0]];media[entityKey(view.tool,view.row)]=result.value.items[0]}
        emit()
      }
    }catch(e){if(!controller.signal.aborted)view.error=toolErrorInfo(e,{now:now()}).message}
    finally{view.loading=false;if(running.get(requestKey)?.controller===controller)running.delete(requestKey);emit()}
  }
  async function adaptResults(binding,layout='list'){
    const page=current(),b=page.bindings[binding],tool=page.spec.bindings[binding]?.tool
    if(!enabled||!complete||!visible||disposed||glm||b?.status!=='success'||!Array.isArray(b.value?.items)||!b.value.items.length)return
    const stamp=key({input:b.inputKey,value:b.value}),activation=epoch,controller=new AbortController(),requestKey='host-adapt'
    glm=requestKey;running.set(requestKey,{controller,cause:'user'});page.error='';emit()
    try{
      const input={prompt:`根据实际工具结果重新组织内容，呈现方式：${['list','gallery','table','editorial'].includes(layout)?layout:'list'}。仅使用给定样本事实，注明样本覆盖范围，不编造缺失数据，不重复查询失败来源。直接展示结果。`,context:resultContext(tool,b.value)}
      const result=await transport({tool:'glm.generate',input,target:'page',requestId:id(),pageId:page.id,sessionId:spec.cardId,cause:'user',view:{designPreference:page.spec.context?.designPreference,debugGeneration:page.spec.context?.debugGeneration,expressionDialect:page.spec.context?.expressionDialect,modelProfile:page.spec.context?.modelProfile,generationProfile:page.spec.context?.generationProfile,renderMode:getRenderMode(),generationMode:page.spec.context?.generationMode,cardSize:normalizeCardSize(getCardSize()),goal:spec.context?.userGoal||page.spec.intro||'',width:page.viewState.width||432,height:page.viewState.height||432}},controller.signal)
      if(disposed||controller.signal.aborted||epoch!==activation||current()!==page||stamp!==key({input:b.inputKey,value:b.value}))return
      if(result.kind!=='page')throw new Error('生成结果不是页面')
      push(newPage(result.spec,result.resources))
    }catch(e){if(!controller.signal.aborted){page.error=e.message;emit()}}
    finally{if(running.get(requestKey)?.controller===controller){running.delete(requestKey);glm=null;emit()}}
  }
  async function followup(intent){
    const page=current();if(!enabled||!complete||!visible||disposed||glm)return
    if(!followupEntries(page.spec.generationPlan).some(f=>f.prompt===intent))return
    const controller=new AbortController(),activation=epoch,requestKey='host-followup'
    const inputs=()=>({state:clone(page.store.values),selections:Object.entries(page.viewState.components||{}).filter(([,v])=>v.collection?.selected!=null||v.experience?.selected?.length).slice(0,3).map(([id,v])=>v.experience?{component:id,ids:v.experience.selected,items:v.experience.selectedItems||[]}:{component:id,id:v.collection.selected,item:v.collection.selectedItem}),toolEvidence:Object.entries(page.bindings).filter(([,b])=>b.status==='success').slice(0,3).map(([id,b])=>boundedEvidence(page.spec.bindings[id].tool,b.value))})
    const context=inputs(),stamp=key(context)
    context.prefetched=(page.spec.prefetched||[]).slice(0,2).map(r=>boundedEvidence(r.tool,r.value))
    if(JSON.stringify(context).length>14000){page.error='当前选择过多，请缩小范围后再生成';emit();return}
    glm=requestKey;running.set(requestKey,{controller,cause:'user'});page.error='';emit()
    try{
      const result=await transport({tool:'glm.generate',input:{prompt:intent,context},target:'page',requestId:id(),pageId:page.id,sessionId:spec.cardId,cause:'user',view:{designPreference:page.spec.context?.designPreference,debugGeneration:page.spec.context?.debugGeneration,expressionDialect:page.spec.context?.expressionDialect,modelProfile:page.spec.context?.modelProfile,generationProfile:page.spec.context?.generationProfile,renderMode:getRenderMode(),goal:spec.context?.userGoal,summary:String(page.spec.intro||'').slice(0,1000),taskPhase:'result',cardSize:normalizeCardSize(getCardSize()),generationMode:'direct'}},controller.signal)
      if(disposed||controller.signal.aborted||epoch!==activation||current()!==page)return
      if(stamp!==key(inputs())){page.error='输入已改变，请按当前选择重新生成';emit();return}
      if(result.kind!=='page')throw Error('生成结果不是页面')
      push(newPage(result.spec,result.resources))
    }catch(e){if(!controller.signal.aborted){page.error=e.message;emit()}}
    finally{if(running.get(requestKey)?.controller===controller){running.delete(requestKey);glm=null;emit()}}
  }
  return {
    sourceLeases,assertSourcesCurrent,
    followup,openResults,openDetail,adaptResults,loadDetails,
    resultMedia(tool,row){const image=media[entityKey(tool,row)];return image?{...row,...image,title:row.title||row.name||image.title}:row},
    setResultView(patch){current().viewState={...current().viewState,...patch};emit()},
    isFavorite(tool,row){return !!favorites[entityKey(tool,row)]},
    toggleFavorite(tool,row){const k=entityKey(tool,row);if(favorites[k])delete favorites[k];else if(Object.keys(favorites).length<100)favorites[k]={title:String(row.title||row.name||row.id||'条目')};else notice='最多保存 100 个收藏';emit()},
    current,scope,fire,invoke,tick,get complete(){return complete},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},snapshot:()=>version,
    get pages(){return pages},get index(){return index},get busy(){return !!glm},get notice(){return storageError||notice},
    setActivity(options){const nextVisible=options.visible??visible,nextEnabled=options.enabled??enabled,wasComplete=complete;complete=options.complete??complete;if((visible&&!nextVisible)||(enabled&&!nextEnabled))cancelAll();visible=nextVisible;enabled=nextEnabled;if(wasComplete!==complete)emit();tick()},
    updateRoot(next,resources){if(next.cardId!==spec.cardId)return;const p=pages.find(p=>p.id===next.cardId);if(p){p.spec=next;p.resources=resources||p.resources;makeScope(p.spec,p.store,{bindings:p.bindings});seedPrefetched(p);emit()}},
    navigate(offset){const next=index+offset;if(next<0||next>=pages.length)return;cancelAll();index=next;emit();tick()},
    cancel(){cancelAll();for(const b of Object.values(current().bindings))if(b.status==='cancelled')b.paused=true;emit()},saveView(view){current().viewState={...current().viewState,...view};persist()},save:persist,
    acknowledgeWrite(binding){const b=current().bindings[binding];if(b?.blockedRetry){b.blockedRetry=false;b.writeSubmitted=false;b.status='idle';b.error='';current().error='';emit()}},
    updateSlot(slotId,action,extra){const page=current().slots[slotId];if(!page)return;executeAction(page.spec,page.store,action,extra);emit()},
    retry(binding){const b=record(current(),binding);if(b.blockedRetry){current().error='外部操作可能已经生效，请先到原站点核对，不能直接重试';emit();return}const r=b.retry||{binding,target:b.target};if(r.watchInputKey){try{const input=r.inputExpression?evaluate(r.inputExpression,scope(current(),r.extra||{})):inputFor(current(),binding,r.extra||{});if(key(input)!==r.watchInputKey)throw Error('输入已改变，请使用卡片按钮发起新请求')}catch(e){current().error=e.message;emit();return}}return invoke(r,{extra:r.extra||{},cause:'user'})},
    dispose(){disposed=true;cancelAll();clearTimeout(persistTimer);persist();listeners.clear()}
  }
}
