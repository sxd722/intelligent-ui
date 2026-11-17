const pending=new Map();let timer,flushing=false
const storageKey='cardspec:rsi-events:v1'
const persist=()=>{try{sessionStorage.setItem(storageKey,JSON.stringify([...pending]))}catch{/* In-memory interaction still works when tab storage is full. */}}
if(typeof window!=='undefined')try{for(const [id,events]of JSON.parse(sessionStorage.getItem(storageKey)||'[]'))if(typeof id==='string'&&Array.isArray(events))pending.set(id,events);if(pending.size)timer=setTimeout(flushRsi,800)}catch{}
function batchOf(events,maxBytes=180000){const batch=[];let bytes=32;for(const event of events.slice(0,100)){const n=new TextEncoder().encode(JSON.stringify(event)).length+1;if(batch.length&&bytes+n>maxBytes)break;batch.push(event);bytes+=n}return batch}
export function recordRsi(id,event){
 if(typeof window==='undefined'||!id||import.meta.env?.VITE_CLOUD_NO_TOOLS==='1')return
 const list=pending.get(id)||[];list.push({eventId:crypto.randomUUID(),at:new Date().toISOString(),...event});pending.set(id,list)
 persist()
 clearTimeout(timer);timer=setTimeout(flushRsi,800)
}
export function recordUiInteraction(id,el){
 if(!id)return
 const interactionId=crypto.randomUUID(),label=(el.getAttribute('aria-label')||el.textContent||el.name||'').slice(0,180)
 recordRsi(id,{kind:'ui-click',interactionId,label,role:el.getAttribute('role')||el.tagName})
 const card=el.closest('.cs-tool-card')||el.closest('.cs-card')
 if(card)requestAnimationFrame(()=>requestAnimationFrame(()=>{if(card.isConnected)recordRsi(id,{kind:'ui-result',interactionId,label,visibleText:card.innerText.slice(0,2400),truncated:card.innerText.length>2400})}))
}
export async function flushRsi(){
 if(flushing)return;clearTimeout(timer);flushing=true
 try{for(const [id,events]of [...pending]){
  while(events.length){const batch=batchOf(events);try{const response=await fetch('/api/rsi-journal/'+encodeURIComponent(id)+'/interactions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({events:batch})});if(!response.ok)break;events.splice(0,batch.length);persist()}catch{break}}
  if(!events.length)pending.delete(id)
 }}finally{flushing=false;persist();if(pending.size){clearTimeout(timer);timer=setTimeout(flushRsi,5000)}}
}
if(typeof window!=='undefined')window.addEventListener('pagehide',()=>{persist();for(const[id,events]of pending){const batch=batchOf(events,48000);if(batch.length)navigator.sendBeacon('/api/rsi-journal/'+encodeURIComponent(id)+'/interactions',new Blob([JSON.stringify({events:batch})],{type:'application/json'}))}})
