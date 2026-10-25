// Pure helpers are installed inside QuickJS, never as host callbacks.
export function createNumeric(){
 const vector=x=>{if(!Array.isArray(x)||!x.length||x.length>64||x.some(v=>!Number.isFinite(v)))throw Error('expected 1–64 finite values');return x}
 const matrix=x=>{if(!Array.isArray(x)||!x.length||x.length>64)throw Error('expected matrix');x.forEach(vector);if(x.some(r=>r.length!==x[0].length))throw Error('ragged matrix');return x}
 return Object.freeze({
  softmax(x){vector(x);const m=Math.max(...x),e=x.map(v=>Math.exp(v-m)),sum=e.reduce((a,b)=>a+b,0);return e.map(v=>v/sum)},
  norm(x,epsilon=1e-5){vector(x);if(!Number.isFinite(epsilon)||epsilon<=0)throw Error('positive epsilon required');const mean=x.reduce((a,b)=>a+b,0)/x.length,variance=x.reduce((a,b)=>a+(b-mean)**2,0)/x.length;return x.map(v=>(v-mean)/Math.sqrt(variance+epsilon))},
  matmul(a,b){matrix(a);matrix(b);if(a[0].length!==b.length)throw Error('matrix dimensions do not align');return a.map(row=>b[0].map((_,j)=>row.reduce((s,v,k)=>s+v*b[k][j],0)))},
  gelu(x){vector(x);return x.map(v=>.5*v*(1+Math.tanh(Math.sqrt(2/Math.PI)*(v+.044715*v**3))))}
 })
}
