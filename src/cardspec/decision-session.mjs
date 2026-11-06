import{decisionProfile,decisionRequest,mergeDecisionDetails,normalizeDecisionRow}from'../../shared/cardspec/decision-profile.mjs';
import{canonicalInput}from'../../shared/cardspec/prefetch.mjs';
import{TOOLS,validateToolInput,validateJson}from'../../shared/cardspec/tools.mjs';
const clone=x=>structuredClone(x);
export function createDecisionSession({current,inputFor,ready,transport,running,id,emit}){
 let tail=Promise.resolve();
 const stamp=b=>canonicalInput([b.definitionKey,b.version||0,b.updatedAt]);
 const keyOf=(binding,b,row,profile)=>canonicalInput([binding,b.definitionKey,row.rowKey||String(row[profile.entity])]);
 function data(binding){const p=current(),b=p.bindings[binding],tool=p.spec.bindings[binding]?.tool,profile=decisionProfile(tool);if(!profile||!b?.value)return b?.value;
  return {...b.value,items:(b.value.items||[]).map(row=>{const e=p.taskEntities?.[keyOf(binding,b,row,profile)];return {...normalizeDecisionRow(tool,row),...(e?.stamp===stamp(b)?e.row:{}),_task:e?.stamp===stamp(b)?{status:e.status==='loading'&&![...running.keys()].some(k=>k.startsWith('decision:'+keyOf(binding,b,row,profile)+':'))?'idle':e.status,error:e.error,details:e.details,updatedAt:e.updatedAt}:{status:'idle'}}})};
 }
 function read(binding,row,{kind='facts',force=false}={}){
  const p=current(),b=p.bindings[binding],tool=p.spec.bindings[binding]?.tool,profile=decisionProfile(tool);
  if(!ready()||!profile||b?.status!=='success'||b.definitionKey!==JSON.stringify(inputFor(p,binding)))return Promise.reject(Error('TASK_SOURCE_NOT_READY'));
  const raw=b.value?.items?.find(r=>r.rowKey?row.rowKey===r.rowKey:String(r[profile.entity])===String(row[profile.entity]));
  if(!raw)return Promise.reject(Error('TASK_STALE_ENTITY'));
  const input=clone(inputFor(p,binding)),signature=stamp(b),entityKey=keyOf(binding,b,raw,profile),request=decisionRequest(tool,raw,input,kind),requestKey='decision:'+entityKey+':'+kind;
  validateToolInput(request.tool,request.input);if(TOOLS[request.tool]?.readOnly!==true)return Promise.reject(Error('TASK_READ_ONLY'));
  const prior=p.taskEntities?.[entityKey];if(!force&&prior?.stamp===signature&&prior.details?.[kind])return Promise.resolve(prior.details[kind]);
  if(running.has(requestKey))return running.get(requestKey).promise;
  const controller=new AbortController(),task={controller,binding,cause:'decision',promise:null};running.set(requestKey,task);
  const valid=()=>ready()&&!controller.signal.aborted&&current()===p&&running.get(requestKey)===task&&p.bindings[binding]?.status==='success'&&stamp(p.bindings[binding])===signature&&JSON.stringify(inputFor(p,binding))===b.definitionKey;
  const put=patch=>{p.taskEntities||={};const old=p.taskEntities[entityKey];p.taskEntities[entityKey]={...(old?.stamp===signature?old:{stamp:signature,details:{}}),...patch};const keys=Object.keys(p.taskEntities);if(keys.length>160)delete p.taskEntities[keys.find(k=>k!==entityKey)];emit()};
  task.promise=(async()=>{const previous=tail;let release;tail=new Promise(r=>release=r);try{await previous;if(!valid())throw Error('TASK_STALE_DETAIL');put({status:'loading',error:''});
   const result=await transport({...request,...(force?{cache:'reload'}:{}),target:'binding',requestId:id(),pageId:p.id,sessionId:p.spec.cardId,cause:'user'},controller.signal);
   if(!valid())throw Error('TASK_STALE_DETAIL');if(result.kind!=='json')throw Error('TASK_DETAIL_SHAPE');validateJson(result.value,TOOLS[request.tool].outputSchema);
   let merged=p.taskEntities[entityKey]?.row;
   if(profile.kind==='poster'&&kind==='facts')merged=mergeDecisionDetails(tool,raw,result.value);
   if(profile.kind==='poster'&&kind==='media'){const photo=result.value.items.find(x=>String(x.subject_id)===String(raw.id));if(photo)merged={...(merged||normalizeDecisionRow(tool,raw)),assetRef:photo.assetRef||merged?.assetRef,cover:photo.image_url};}
   let value=clone(result.value);if(kind==='stops'){const a=value.items.findIndex(r=>r.station_name===input.from),z=value.items.findIndex(r=>r.station_name===input.to);value={...value,fullRoute:!(a>=0&&z>=a),items:a>=0&&z>=a?value.items.slice(a,z+1):value.items};}
   put({status:'success',error:'',row:merged,details:{...p.taskEntities[entityKey]?.details,[kind]:value},updatedAt:new Date().toISOString()});return value;
  }catch(e){if(valid())put({status:'error',error:e.message});throw e}finally{if(running.get(requestKey)===task)running.delete(requestKey);release?.()}})();return task.promise;
 }
 return {taskData:data,readTaskEntity:read};
}
