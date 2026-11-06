// Incremental, display-only projection. Never infer text or token usage that the
// provider did not send. Keep this separate from the 400-frame raw inspector ring.
const labels={running:'执行中',planning:'规划中',succeeded:'完成',failed:'失败',cancelled:'已取消',cached:'缓存命中',empty:'无结果',fallback:'已回退',repairing:'修复中',partial:'部分完成'}
const names={goal:'目标',pattern:'表达方式',primary:'主视觉',interaction:'核心交互',followups:'后续交互',resources:'资料与图片',disclosure:'信息层级',input:'输入',query:'查询',keyword:'关键词',limit:'数量',id:'工具',reason:'原因'}
const finite=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0
const clip=s=>String(s??'').slice(0,100000)
export function readableData(value,depth=0){
  if(value==null)return ''
  if(typeof value!=='object')return String(value)
  if(depth>5)return '（更深内容见 Frames）'
  return Object.entries(value).slice(0,40).map(([k,v])=>`- ${Array.isArray(value)?'':`${names[k]||k}：`}${typeof v==='object'&&v!==null?'\n'+readableData(v,depth+1):String(v??'—')}`).join('\n')
}
export function readableOutput(text){
  try{return readableData(JSON.parse(text))}catch{return text}
}
export function usageLabel(u){
  if(!u||typeof u!=='object')return ''
  const fields=[['输入',u.prompt_tokens??u.input_tokens],['输出',u.completion_tokens??u.output_tokens],['合计',u.total_tokens],['推理（输出内）',u.completion_tokens_details?.reasoning_tokens??u.output_tokens_details?.reasoning_tokens]]
  return fields.filter(([,v])=>finite(v)).map(([k,v])=>`${k} ${v.toLocaleString()} tokens`).join(' · ')
}
export function createStreamNarrative(){
  const entries=[],textSlots=new Map(),tools=new Map();let seq=0,origin=null,phase='生成',phaseId='',phaseEntry,last={p:'',o:'add'},totalMs=null,model='',status='',dropped=0,revision=0
  const add=(kind,title,text,at,extra={})=>{const e={id:++seq,kind,title,text:clip(text),at:Math.max(0,at-origin),...extra};entries.push(e);if(entries.length>300){entries.shift();dropped++}return e}
  function textValue(key,value,op,at){
    if(typeof value!=='string')return
    const slotKey=phaseId+':'+key,old=textSlots.get(slotKey)||{value:'',entry:null}
    const next=clip(op==='append'?old.value+value:value)
    if(next===old.value)return
    if(op!=='append'){
      for(let i=entries.length-1;i>=0;i--)if(entries[i].streamKey===slotKey)entries.splice(i,1)
      old.entry=null
    }
    const incremental=op==='append'&&entries.at(-1)===old.entry
    if(incremental)old.entry.text=clip(old.entry.text+value)
    else if(op==='append')old.entry=add(key,key==='reasoning'?'模型推理':`${phase} · 模型输出`,value,at)
    else if(old.entry&&entries.includes(old.entry))old.entry.text=next
    else old.entry=add(key,key==='reasoning'?'模型推理':`${phase} · 模型输出`,next,at)
    if(old.entry)old.entry.streamKey=slotKey
    old.value=next;textSlots.set(slotKey,old)
  }
  function message(m,at){if(!m)return;textValue('reasoning',m.reasoning,'replace',at);textValue('output',m.content?.parts?.[0],'replace',at)}
  function op(raw,at){
    const p=raw.p??last.p,o=raw.o??last.o;last={p,o};const v=raw.v
    if(p==='')message(v?.message,at)
    else if(p==='/message')message(v,at)
    else if(p==='/message/reasoning')textValue('reasoning',o==='remove'?'':v,o,at)
    else if(p==='/message/content/parts/0')textValue('output',o==='remove'?'':v,o,at)
    else if(p==='/message/content')textValue('output',v?.parts?.[0],o,at)
    else if(p==='/message/content/parts')textValue('output',v?.[0],o,at)
  }
  function push(f,at=performance.now()){
    if(!f||typeof f!=='object')return
    if(origin===null)origin=at
    revision++
    if('v'in f||'p'in f||'o'in f){
      if(f.p!==undefined)last={p:f.p,o:f.o??'add'}
      else if(f.o!==undefined&&f.o!=='patch')last={...last,o:f.o}
      if(Array.isArray(f.v)&&f.v.every(x=>x&&typeof x==='object'&&('p'in x||'o'in x)))for(const x of f.v)op(x,at)
      else op(f,at)
      return
    }
    const type=f.type,st=labels[f.status]||f.status||''
    if(type==='phase_begin'){
      phase=f.title||f.phase||'生成';phaseId=f.id||String(seq);textSlots.clear()
      phaseEntry=add('phase',phase,'',at,{status:'执行中',phase:f.phase});return
    }
    if(type==='phase_end'){if(phaseEntry){phaseEntry.status=st;phaseEntry.elapsedMs=Math.max(0,at-origin-phaseEntry.at);phaseEntry.estimated=true}return}
    if(type==='server_ste_metadata'){
      const m=f.metadata||{};totalMs=finite(m.total_ms)?m.total_ms:totalMs;model=m.model_slug||model
      if(m.phases)for(const e of entries.filter(e=>e.kind==='phase')){const t=m.phases[e.phase];if(finite(t)){e.elapsedMs=t;e.estimated=false}}
      add('metrics','服务端统计',[m.model_slug?`模型：${m.model_slug}`:'',finite(m.total_ms)?`总耗时：${(m.total_ms/1000).toFixed(2)} 秒`:'',finite(m.first_content_ms)?`首个内容：${(m.first_content_ms/1000).toFixed(2)} 秒`:'',finite(m.repair_count)?`修复次数：${m.repair_count}`:'',usageLabel(m.usage)].filter(Boolean).join('\n\n'),at);return
    }
    if(type==='message_stream_complete'){status=st;for(const e of tools.values())if(e.status==='执行中')e.status='未收到结束事件';tools.clear();return}
    if(type==='research'||type==='tool_call'||type==='tool_result'){
      const tool=f.tool||f.name||'工具',key=f.callId||f.toolCallId||tool
      let e=tools.get(key)
      if(f.status==='running'||type==='tool_call'||!e){e=add('tool',f.input?.id?`${tool} · ${f.input.id}`:tool,readableData(f.input??f.arguments),at,{status:st||'执行中'});tools.set(key,e)}
      else{e.status=st;e.elapsedMs=finite(f.elapsedMs)?f.elapsedMs:Math.max(0,at-origin-e.at);e.estimated=!finite(f.elapsedMs)}
      e.usage=usageLabel(f.usage)||e.usage
      const details=[f.error?.message||f.error,f.sourceIds?.length?`返回 ${f.sourceIds.length} 个来源`:'',finite(f.contextCharacters)?`累计资料上下文 ${f.contextCharacters} 字符`:''].filter(Boolean).join('\n\n')
      if(details)e.text=clip(e.text+'\n\n'+details)
      if(f.status!=='running'&&type!=='tool_call')tools.delete(key)
      return
    }
    if(type==='research_model'){model=f.model||model;add('model','模型调用完成',f.model||'',at,{usage:usageLabel(f.usage)});return}
    if(type==='cardplan'||type==='experience'){
      add('plan',type==='cardplan'?'卡片规划':'体验规划',readableData(f.plan)||f.reason||f.error||'',at,{status:st,elapsedMs:f.elapsedMs,usage:usageLabel(f.usage)});return
    }
    if(type==='stream_error'){add('error','生成错误',f.error?.message||f.message||'流异常',at,{status:st||'失败'});return}
    if(['stream_note','build_progress','status','diagnostics','resource-warning','debug','debug_feedback','debug_commit','debug_committed'].includes(type)){
      const title={stream_note:'生成进展',build_progress:'模块构建',status:'生成状态',diagnostics:'校验反馈','resource-warning':'图片提示',debug:'交互调试',debug_feedback:'调试反馈',debug_commit:'提交实现',debug_committed:'实现已提交'}[type]
      add('event',title,[f.note||f.message,f.repair?`修复第 ${f.repair} 轮`:'',f.diagnostics?.slice(0,8).map(d=>`- ${d.message}`).join('\n')].filter(Boolean).join('\n\n'),at,{status:st,elapsedMs:f.elapsedMs,usage:usageLabel(f.usage)})
    }
  }
  return {push,snapshot:()=>({entries,revision,totalMs,model,status,dropped})}
}
