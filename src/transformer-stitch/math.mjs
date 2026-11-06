// Column vectors. Shared weights; one unmasked attention head, no output projection.
export const TOKENS=['The','cat','sat','down'];
export const X0=[[1,-.5,.5,0],[0,1,-.5,.5],[.5,.5,1,-.5],[-.5,0,.5,1]];
export const WQ=[[.8,.2,0,-.1],[0,.7,.2,0],[.1,0,.9,.2],[0,-.2,.1,.8]];
export const WK=[[.6,0,.3,0],[.2,.8,0,-.1],[0,.1,.7,.2],[-.1,0,.2,.9]];
export const WV=[[.7,.1,0,-.2],[0,.8,.2,0],[.3,0,.6,.1],[0,-.1,.2,.7]];
export const W1=[[.8,-.6,.2,.1],[-.5,.9,-.1,.2],[.2,.1,.7,-.8],[-.3,-.4,.8,.5],[.6,.2,-.5,-.3],[-.7,.4,.3,.6]];
export const W2=[[.4,-.2,.1,.3,-.1,.2],[-.1,.5,.2,-.2,.3,.1],[.2,.1,.5,.2,-.3,.1],[.1,-.2,.2,.4,.2,-.3]];
export const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const mv=(m,v)=>m.map(r=>dot(r,v));
export const add=(a,b)=>a.map((v,i)=>v+b[i]);
export const softmax=a=>{const e=a.map(v=>Math.exp(v-Math.max(...a))),sum=e.reduce((s,v)=>s+v,0);return e.map(v=>v/sum)};
export function compute(edits=[0,0,0,0],residual=true){
 const X=X0.map((v,i)=>v.map((x,d)=>x+(d===0?(edits[i]||0):0))),Q=X.map(x=>mv(WQ,x)),K=X.map(x=>mv(WK,x)),V=X.map(x=>mv(WV,x));
 const scores=Q.map(q=>K.map(k=>dot(q,k)/2)),A=scores.map(softmax);
 const C=A.map(row=>[0,1,2,3].map(d=>dot(row,V.map(v=>v[d]))));
 const R=C.map((c,i)=>residual?add(X[i],c):c),Z=R.map(v=>mv(W1,v)),H=Z.map(v=>v.map(x=>Math.max(0,x))),F=H.map(v=>mv(W2,v)),Y=F.map((f,i)=>residual?add(R[i],f):f);
 return {X,Q,K,V,scores,A,C,R,Z,H,F,Y};
}
export const fresh=()=>({version:1,token:1,step:2,key:0,neuron:0,edits:[0,0,0,0],residual:true});
export function normalize(s){const d=fresh();if(!s||s.version!==1)return d;for(const [k,max]of[['token',3],['step',5],['key',3],['neuron',5]])if(Number.isInteger(s[k])&&s[k]>=0&&s[k]<=max)d[k]=s[k];if(Array.isArray(s.edits)&&s.edits.length===4)d.edits=s.edits.map(x=>typeof x==='number'&&Number.isFinite(x)?Math.max(-2,Math.min(2,x)):0);d.residual=s.residual!==false;return d}
