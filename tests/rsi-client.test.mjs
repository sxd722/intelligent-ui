import test from 'node:test'
import assert from 'node:assert/strict'
test('large interaction bursts are byte-batched without dropping the first events',async()=>{
 const saved=new Map(),requests=[]
 globalThis.window={addEventListener(){}}
 globalThis.sessionStorage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)}
 const oldFetch=globalThis.fetch
 globalThis.fetch=async(url,options)=>{requests.push(options.body);return {ok:true}}
 try{
  const {recordRsi,flushRsi}=await import('../src/rsi-client.mjs')
  for(let i=0;i<151;i++)recordRsi('record',{index:i,text:'汉'.repeat(2000)})
  await flushRsi()
  const events=requests.flatMap(body=>JSON.parse(body).events)
  assert.equal(events.length,151);assert.equal(events[0].index,0);assert.equal(events.at(-1).index,150)
  assert.ok(requests.every(body=>Buffer.byteLength(body)<200000));assert.deepEqual(JSON.parse(saved.get('cardspec:rsi-events:v1')),[])
 }finally{globalThis.fetch=oldFetch;delete globalThis.window;delete globalThis.sessionStorage}
})
