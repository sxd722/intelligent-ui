import {sandboxMode,sandboxInstruction} from '../../shared/cardspec/sandbox-policy.mjs'
import {sandboxEnabled} from './sandbox.mjs'
import {PLAN_TEMPERATURE} from '../../shared/cardspec/plan-design.mjs'
import {generateCard} from './generation.mjs'
import {planExperience} from './experience.mjs'
import {experienceMode,validateExperiencePlan} from '../../shared/cardspec/experience.mjs'
import { randomUUID } from 'node:crypto'
import { dateKey } from '../../shared/cardspec/expression.mjs'
import { CARD_ANALYSIS_PROMPT, CARD_PLAN_PROMPT } from './prompt.mjs'
import { planningMessages, assertJsonPrefix, PlanningFormatError, parsePlanningDocument, planningRepairInstruction } from './planning.mjs'
import { toolHealthReference } from '../../shared/cardspec/tools.mjs'
import { generationLayout } from '../../shared/cardspec/generation-layout.mjs'
import {createGenerationBudget,generationPolicy} from './budget.mjs'
import {saveCheckpoint,loadCheckpoint} from './checkpoints.mjs'
import {generationSettings,generationModelOptions} from '../../shared/cardspec/generation-settings.mjs'

import { toolDiscoveryReference,expandedToolIds } from '../../shared/cardspec/tool-discovery.mjs'

export async function handleCardSpec(req, res, payload, { streamUpstream, photo, model, keyLoaded,toolCatalog,researchSession,recordGeneration }) {
  const settings=generationSettings(payload),upstream=streamUpstream
  streamUpstream=(messages,options)=>upstream(messages,{...options,...generationModelOptions(settings.modelProfile)})
  model=generationModelOptions(settings.modelProfile).modelOverride||model
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
  res.flushHeaders?.()
  const requestId = randomUUID(), turnId = payload.turnId || randomUUID(), started = performance.now()
  let cardId = randomUUID()
  const policy=generationPolicy(payload.messages.findLast(m=>m.role==='user')?.content,{profile:payload.generationProfile,mode:payload.mode,debugGeneration:payload.debugGeneration})
  const budget=(policy.profile==='adaptive-v1'||policy.debugGeneration)?createGenerationBudget(policy):null
  const controller = new AbortController(), deadline = setTimeout(() => controller.abort(Object.assign(new Error(`生成超过 ${policy.timeoutMs / 60000} 分钟时限，请重试或缩小任务范围。`),{code:'GENERATION_TIMEOUT'})), policy.timeoutMs)
  res.once('close', () => { if (!res.writableEnded) controller.abort() })
  const layout=generationLayout(payload.cardSize)
  payload={...payload,mode:experienceMode(policy.mode||payload.mode),renderMode:sandboxEnabled()?sandboxMode(payload.renderMode):'native'}
  const context = { generatedAt: new Date().toISOString(), timeZone: 'Asia/Shanghai',cardSize:layout.cardSize,renderMode:payload.renderMode }
  const userGoal=payload.messages.findLast(m=>m.role==='user')?.content?.slice(0,4000)||''
  context.localDate = dateKey(context.generatedAt, context.timeZone)
  const timings = { first_reasoning_ms: null, first_content_ms: null, first_card_ms: null, phases: {}, image_resolution_ms: 0 }
  let phase, repairCount = 0, planRepairCount = 0, lastSource = '', research
  const elapsed = () => Math.round(performance.now() - started)
  const send = (value) => { if (!res.destroyed && !res.writableEnded) res.write(`data: ${typeof value === 'string' ? value : JSON.stringify(value)}\n\n`) }
  const patch = (ops) => send({ o: 'patch', v: ops })
  const meta = (values) => patch([{ p: '/message/metadata', o: 'append', v: values }])
  const begin = (name, title, kind) => {
    phase = { id: randomUUID(), name, started: elapsed() }
    send({ type: 'phase_begin', id: phase.id, phase: name, title, kind, turnId, requestId })
    send({ p: '', o: 'add', v: { message: { id: phase.id, status: 'running', reasoning: '', content: { parts: [''] }, metadata: { phase: name, phase_title: title, kind, format: 'cardspec', requestId, turnId } } } })
  }
  const finish = (status = 'succeeded') => {
    timings.phases[phase.name] = elapsed() - phase.started
    patch([{ p: '/message/status', o: 'replace', v: status }])
    send({ type: 'phase_end', id: phase.id, phase: phase.name, status, turnId, requestId })
  }
  const markPiece = (piece) => {
    if (piece.reasoning && timings.first_reasoning_ms === null) timings.first_reasoning_ms = elapsed()
    if (piece.content && timings.first_content_ms === null) timings.first_content_ms = elapsed()
  }
  const history = payload.messages
  const call = async (messages, options) => {
    const attempt = new AbortController()
    try { return await streamUpstream(messages, { temperature: .4, maxTokens: 8192, reasoningEffort: 'low', budget, ...options, signal: AbortSignal.any([controller.signal, attempt.signal,...(options.signal?[options.signal]:[])]) }) }
    finally { attempt.abort() }
  }
  send({ type: 'delta_encoding', value: 'v1' })
  send({ type: 'turn_begin', turnId, requestId, format: 'cardspec', schemaVersion: 1, timeoutMs:policy.timeoutMs })
  try {
    if (!keyLoaded) throw new Error('server has no model API key')
    const catalog=payload.toolsEnabled===false?[]:(toolCatalog?await toolCatalog():[])
    const allowedTools=catalog.filter(t=>t.available&&!t.unsupportedReason).map(t=>t.id)
    let availableTools=expandedToolIds(catalog,userGoal)
    const discovery=payload.toolsEnabled===false?'工具增强已关闭。':toolDiscoveryReference(catalog,userGoal)
    const disclosure=()=>({expanded:availableTools,availableCount:allowedTools.length,unavailableCount:catalog.length-allowedTools.length,indexCharacters:discovery.length})
    let analysis, plan, experience
    if(payload.mode==='experience'){
      begin('experience','体验规划','plan')
      experience=await planExperience({streamUpstream:call,goal:userGoal,cardSize:layout.cardSize,capabilities:discovery,renderMode:payload.renderMode,signal:controller.signal,onEvent:send})
      meta({experiencePlan:experience.plan,experiencePlanning:experience,model_call_count:1});finish()
    }
    if ((payload.mode || 'direct') === 'staged') {
      for (const step of [
        { name: 'analysis', title: '阶段 1 · 信息规划', prompt: CARD_ANALYSIS_PROMPT, maxTokens: 1536 },
        { name: 'plan', title: '阶段 2 · 交互方案', prompt: CARD_PLAN_PROMPT, maxTokens: 3072 },
      ]) {
        begin(step.name, step.title, 'plan')
        availableTools=expandedToolIds(catalog,userGoal,analysis?[analysis]:[])
        meta({tool_disclosure:disclosure()})
        const messages = planningMessages(step.prompt+'\n'+sandboxInstruction(payload.renderMode)+'\n'+layout.instruction+'\n'+discovery+toolHealthReference(catalog,availableTools)+`\n本轮优先候选（不是全部能力）：${availableTools.join(',')||'无'}。只读CLI结果绑定现有组件，可见时按需轮询；写操作只能由独立用户按钮触发并交给宿主确认；glm.generate只在用户点击后生成下一页或局部slot。只规划需要的工具及用途，不输出binding/action源码或工具schema。`, context, history, analysis, step.name)
        let text = ''
        const collect = (piece) => {
          markPiece(piece)
          if (piece.content) { text += piece.content; assertJsonPrefix(text); patch([{ p: '/message/content/parts/0', o: 'append', v: piece.content }]) }
          if (piece.reasoning) patch([{ p: '/message/reasoning', o: 'append', v: piece.reasoning }])
        }
        let doc, formatError
        const parsePlan=()=>parsePlanningDocument(text,step.name,{onRepair:({source,edits})=>{
          meta({ normalized_plan_source:source, planning_syntax_repairs:edits })
          send({type:'stream_note',note:'已补齐规划 JSON 中缺失的结束括号',requestId,turnId})
        },onNormalize:(changes,doc)=>meta({normalized_plan_source:JSON.stringify(doc),planning_normalizations:changes})})
        meta({ model_call_count: 1 })
        try { await call(messages, { temperature:step.name==='plan'?PLAN_TEMPERATURE:.4, maxTokens: step.maxTokens, responseFormat: { type:'json_object' }, onPiece: collect }) }
        catch (error) { if (!(error instanceof PlanningFormatError) || controller.signal.aborted) throw error; formatError = error }
        try { if (formatError) throw formatError; doc = parsePlan() }
        catch (error) {
          planRepairCount++
          const previous = text; text = ''
          meta({ previous_source: previous, model_call_count: 2, retry_reason: error.message }); patch([{ p: '/message/content/parts/0', o: 'replace', v: '' }, { p: '/message/reasoning', o: 'replace', v: '' }])
          send({ type: 'stream_note', note: '正在修复规划 JSON', requestId, turnId })
          await call([...messages, { role: 'user', content: planningRepairInstruction(error, previous) }], { temperature:step.name==='plan'?PLAN_TEMPERATURE:.4, maxTokens: step.maxTokens, responseFormat: { type:'json_object' }, onPiece: collect })
          doc = parsePlan()
        }
        if (step.name === 'analysis') analysis = doc; else {plan = doc;try{experience={plan:validateExperiencePlan(doc.experiencePlan),status:'reused',elapsedMs:0}}catch{experience={plan:null,status:'fallback',reason:'三阶段未返回有效体验骨架'}}}
        meta({ plan_document: doc }); finish()
      }
    }
    begin('dsl', payload.mode==='experience'?'体验规划 → 卡片生成':payload.mode !== 'staged' ? 'CardSpec · 直接生成' : '阶段 3 · CardSpec 成型', 'cardspec')
    const checkpoint=budget&&payload.resumeToken?await loadCheckpoint(payload.resumeToken,userGoal):null
    if(budget)meta({resumeToken:requestId})
    if(checkpoint)send({type:'stream_note',note:'已恢复上次取数结果；来源时间保持原样，可在卡片内手动刷新。生成使用新的有界预算。',requestId,turnId})
    const deck=[]
    research=researchSession?.(value=>{send({...value,requestId,turnId});if(value.type==='research')send({type:'stream_note',note:value.status==='running'?'正在获取资料 · '+value.tool:value.status==='failed'?'部分资料暂不可用':'已取得资料',requestId,turnId})},{catalog,budget,modelProfile:settings.modelProfile,timeoutMs:policy.timeoutMs,initialRecords:checkpoint?.records||[],renderMode:payload.renderMode,enabled:payload.toolsEnabled!==false,goal:userGoal,...(budget?{allowPlanning:policy.plan}:{}),...(experience?.plan?{allowPlanning:false}:{})})
    const base={streamUpstream:call,photo,catalog,research,budget,signal:controller.signal}
    const emit=value=>{send({...value,requestId,turnId});if(value.type==='debug')send({type:'stream_note',note:value.status==='running'?'正在隔离环境中测试交互':value.status==='passed'?'模拟交互检查通过':value.status==='partial'?'部分交互未覆盖，已记录调试范围':value.status==='unverified'?'调试环境未完成验证，保留编译结果':'发现交互问题，准备修复',requestId,turnId});if(value.type==='status'&&value.status==='repairing'){repairCount++;send({type:'stream_note',note:'正在修复 CardSpec 校验或运行错误',requestId,turnId});meta({previous_source:lastSource});patch([{p:'/message/content/parts/0',o:'replace',v:''}]);lastSource=''}}
    const first=await generateCard({...base,cardId,experience,input:{prompt:userGoal},view:{...settings,generationProfile:policy.profile,renderMode:payload.renderMode,goal:userGoal,plan,analysis,history:payload.messages.slice(0,-1),cardSize:layout.cardSize,generationMode:payload.mode},emit,
      onValidated:result=>{if(!budget)return;budget.usable();timings.first_usable_ms=elapsed();meta({card_spec:result.spec,core_ready:true,resources:{},generationBudget:budget.snapshot()})},
      onPiece:piece=>{markPiece(piece);if(piece.content){lastSource+=piece.content;patch([{p:'/message/content/parts/0',o:'append',v:piece.content}])}if(piece.reasoning)patch([{p:'/message/reasoning',o:'append',v:piece.reasoning}])},
      onPreview:spec=>{if(timings.first_card_ms===null)timings.first_card_ms=elapsed();meta({card_spec:spec,card_intro:spec.intro,card_outro:spec.outro})}})
    // Publish only the committed candidate; streamed drafts are trace, never history.
    lastSource=first.source
    patch([{p:'/message/content/parts/0',o:'replace',v:first.source}])
    meta({validated_source:first.source})
    const manifest=research?.plan?.()
    research?.lockPlan?.()
    deck.push({id:first.spec.cardId,title:manifest?.cards[0]?.title||'主卡',status:'ready',...first})
    for(const [i,p]of(manifest?.cards||[]).entries())if(i)deck.push({id:randomUUID(),title:p.title,goal:p.goal,status:'pending'})
    const publish=()=>meta({card_spec:first.spec,card_intro:first.spec.intro,card_outro:first.spec.outro,resources:first.resources,diagnostics:first.diagnostics,repair_count:first.repairCount,experienceDiagnostics:first.spec.experienceDiagnostics,card_deck:deck,model_call_count:budget?.snapshot().modelCalls||research?.snapshot().modelCalls||1,research:research?.snapshot(),generationBudget:budget?.snapshot()})
    publish()
    for(let i=1;i<deck.length;i++){
      deck[i].status='generating';publish()
      try{
        const next=await generateCard({...base,cardId:deck[i].id,input:{prompt:deck[i].goal},view:{...settings,generationProfile:policy.profile,renderMode:payload.renderMode,goal:userGoal,cardSize:layout.cardSize,generationMode:'direct',plan:manifest.cards[i]},emit:value=>send({...value,cardIndex:i,requestId,turnId})})
        next.spec.generationPlan=null
        Object.assign(deck[i],next,{status:'ready'})
      }catch(e){Object.assign(deck[i],{status:'error',error:controller.signal.aborted?'生成已中断':e.message})}
      publish()
    }
    finish()
    if(budget&&recordGeneration)await recordGeneration({requestId,goal:userGoal,results:deck.filter(r=>r.status==='ready'),budget:budget.snapshot()}).catch(e=>send({type:'stream_note',note:'RSI trace保存失败：'+e.message,requestId,turnId}))
    send({type:'server_ste_metadata',metadata:{...timings,total_ms:elapsed(),model_slug:model,mode:payload.mode,format:'cardspec',repair_count:first.repairCount,deck_count:deck.length,plan_repair_count:planRepairCount,research:research?.snapshot(),generationBudget:budget?.snapshot()},requestId,turnId})
    send({type:'message_stream_complete',status:'succeeded',requestId,turnId})
  } catch (e) {
    if(budget&&research?.records)await saveCheckpoint(requestId,userGoal,research.records()).catch(()=>{})
    if(budget&&recordGeneration)await recordGeneration({requestId,goal:userGoal,budget:budget.snapshot(),error:e.message,results:lastSource?[{source:lastSource}]:[]}).catch(()=>{})
    const timedOut = controller.signal.reason?.code === 'GENERATION_TIMEOUT'
    const error = timedOut ? controller.signal.reason : e
    const status = controller.signal.aborted && !timedOut ? 'cancelled' : 'failed'
    if (phase) finish(status)
    send({ type: 'stream_error', status, error: { message: error.message || 'generation interrupted', code:error.code, timeoutMs:timedOut?policy.timeoutMs:undefined }, requestId, turnId })
    send({ type: 'server_ste_metadata', metadata: { ...timings, total_ms: elapsed(), model_slug: model, mode: payload.mode || 'direct', format: 'cardspec', repair_count: repairCount, plan_repair_count: planRepairCount, generationBudget:budget?.snapshot(), status }, requestId, turnId })
    send({ type: 'message_stream_complete', status, requestId, turnId })
  } finally { clearTimeout(deadline); controller.abort(); send('[DONE]'); res.end() }
}
