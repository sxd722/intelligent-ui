const KEY='cardspec:conversation:v1'
const epochs=new WeakMap()
export const conversationEpoch=storage=>storage?epochs.get(storage)||0:0
export function clearConversation(storage){
  // Retired card sessions may dispose asynchronously: they must not resurrect data.
  if(storage)epochs.set(storage,conversationEpoch(storage)+1)
  try{
    const keys=[]
    for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key===KEY||key?.startsWith('cardspec:pages:'))keys.push(key)}
    for(const key of keys)storage.removeItem(key)
    return ''
  }catch{return '对话已从页面清空，但浏览器存储清理失败，刷新后可能恢复旧记录'}
}
export function readConversation(storage){try{
  const saved=JSON.parse(storage.getItem(KEY)||'null')
  if(!Array.isArray(saved?.messages))return {messages:[],toolsEnabled:true}
  for(const message of saved.messages)if(message.role!=='user'){
    if(message.status==='running')message.status='cancelled'
    for(const phase of message.phases||[])if(phase.live){phase.live=false;phase.status='cancelled'}
  }
  return saved
}catch{return {messages:[],toolsEnabled:true}}}
export function saveConversation(storage,messages,toolsEnabled){
  // Stream traces/envelopes are debugging material, not necessary to restore UI.
  const compact=messages.map(m=>m.role==='user'?m:{...m,phases:m.phases.map(p=>{
    const {envelope,...phase}=p
    if(phase.message){phase.message={...phase.message,reasoning:'',metadata:{...phase.message.metadata}};delete phase.message.metadata.previous_source}
    return phase
  })})
  try{storage.setItem(KEY,JSON.stringify({version:1,messages:compact,toolsEnabled}));return ''}
  catch{return '本地存储空间不足，刷新后可能无法恢复本次对话'}
}
