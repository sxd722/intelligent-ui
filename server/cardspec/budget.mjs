import {planningPolicy} from './compact-prompt.mjs'
import {randomUUID} from 'node:crypto'
const leases=new Map()
export function leaseBudget(budget){
 for(const [id,b]of leases)if(!b.remaining())leases.delete(id)
 if(leases.size>=256)leases.delete(leases.keys().next().value)
 const id=randomUUID();leases.set(id,budget);return id
}
export function inheritedBudget(id){const b=leases.get(id);if(!b)throw Object.assign(Error('增强生成预算已过期，原生卡可继续使用'),{code:'GENERATION_BUDGET'});b.check();return b}

export function generationPolicy(goal,{profile,mode,debugGeneration=false}={}){
 const text=String(goal||''),active=profile==='adaptive-v1',plan=planningPolicy(goal).allowPlanning
 const complex=plan||/(舆情|多源|多步|模拟|simulat|多选|行程|itinerary|回合|矩阵|MLP|FFN|transformer)|\d+\s*(条|段|章).{0,20}\d+\s*字|全文|长篇/i.test(text)
 return {debugGeneration,repairs:debugGeneration?8:1,profile:active?'adaptive-v1':'legacy',complex,timeoutMs:debugGeneration?900000:active&&!complex?300000:900000,
  modelCalls:debugGeneration?24:active?(complex?6:3):Infinity,reads:active?(complex?12:3):6,
  plan:active?plan:undefined,mode:active?'direct':mode}
}
export function createGenerationBudget(policy,{now=Date.now}={}){
 const started=now(),deadline=started+policy.timeoutMs,events=[];let models=0,reads=0,repairs=0,firstUsableMs=null
 const failure=message=>Object.assign(Error(message),{code:'GENERATION_BUDGET'})
 const check=()=>{if(now()>=deadline)throw failure('本次生成时间预算已用完；保留已完成内容')}
 return {
  policy,deadline,remaining:()=>Math.max(0,deadline-now()),
  model(kind='generate'){
   check()
   if(['plan','analyze','dataset-analyze'].includes(kind)&&models>=policy.modelCalls-(1+Math.max(0,(policy.repairs||1)-repairs)))throw failure('已为完整生成和校验修复预留预算；跳过本次可选规划/分析，保留现有资料')
   if(models>=policy.modelCalls)throw failure('本次模型调用预算已用完')
   models++;events.push({kind,atMs:now()-started})
  },
  remainingModels:()=>Math.max(0,policy.modelCalls-models),
  generationReserve:()=>1+Math.max(0,(policy.repairs||1)-repairs),
  read(){check();if(reads>=policy.reads)throw failure('本次真实取数预算已用完');reads++;},
  repair(){check();if(repairs>=(policy.repairs||1))throw failure('本次修复预算已用完');repairs++;},
  usable(){if(firstUsableMs==null)firstUsableMs=now()-started},
  check,
  snapshot:()=>({profile:policy.profile,complex:policy.complex,modelCalls:models,reads,repairs,firstUsableMs,elapsedMs:now()-started,deadline:new Date(deadline).toISOString(),events:[...events]})
 }
}
