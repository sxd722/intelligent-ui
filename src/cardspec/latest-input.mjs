// Parent input is a snapshot, not an event: retain only the newest queued value.
// Event actions still use their own ordered transaction path.
export function latestInputPump(request, apply, fail) {
 let running=false, closed=false, version=0, pending=null
 async function drain(){
  if(running||closed)return
  running=true
  try{while(pending&&!closed){
   const next=pending;pending=null
   try{const result=await request(next.value);if(!closed&&next.version===version)apply(result)}
   catch(error){if(!closed&&next.version===version)fail(error)}
  }}finally{running=false}
 }
 return {push(value){if(closed)return;pending={value,version:++version};void drain()},close(){closed=true;pending=null}}
}
