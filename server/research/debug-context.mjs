// Compact completed debug exchanges, never an unfinished tool response group.
// The latest assistant/tool pair remains byte-for-byte intact for gateways.
export function compactDebugHistory(history,baseLength,snapshot){
 const groups=[]
 for(let i=baseLength;i<history.length;i++){
  const message=history[i]
  if(message.role==='assistant'&&message.tool_calls?.length){
   const group=[message];while(history[i+1]?.role==='tool')group.push(history[++i])
   groups.push(group)
  }else groups.push([message])
 }
 const debug=g=>g[0].role==='assistant'&&g[0].tool_calls?.every(c=>['card_test','card_retest','card_commit','card_source'].includes(c.function.name))&&g.length===g[0].tool_calls.length+1
 const removable=groups.slice(0,-1).filter(debug)
 if(!removable.length)return null
 const latest=groups.at(-1),lastHasSource=latest?.[0]?.tool_calls?.some(c=>c.function.name==='card_test')
 const memo={kind:'host_debug_checkpoint',...snapshot}
 if(lastHasSource)delete memo.source
 if(memo.sourceRetrieval&&['test','none'].includes(memo.feedback?.repairLane)){delete memo.source;memo.sourceInstruction='源码已保存；仅需修改实现时调用 card_source(candidateVersion)，补测不需要源码。'}
 const retained=groups.filter((g,i)=>i===groups.length-1||!debug(g)&&!g[0].content?.startsWith('宿主调试检查点（')).flat()
 const next=[...history.slice(0,baseLength),{role:'user',content:'宿主调试检查点（原始trace保存在宿主；不是新需求）。源码不变时使用card_retest，提交使用card_commit。\n'+JSON.stringify(memo)},...retained]
 const before=JSON.stringify(history).length,after=JSON.stringify(next).length
 if(after>=before)return null
 history.splice(0,history.length,...next)
 return {beforeCharacters:before,afterCharacters:after,removedExchanges:removable.length}
}
