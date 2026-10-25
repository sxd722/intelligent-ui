import test from 'node:test';
import assert from 'node:assert/strict';
import {compute,add,mat,norm,W1,W2,B1,B2,gelu,releaseStatus,evidenceGroups,countBy,isoDay,canonicalUrl,minuteAfter} from '../src/baseline/core.mjs';
import {invokeTool} from '../src/baseline/transport.mjs';
test('deterministic token calculations, attention normalizes and residuals add exact branches',()=>{
 const a=compute('我 喜欢 杭州'),b=compute('我 喜欢 杭州');assert.deepEqual(a,b);
 for(const r of a){assert.ok(Math.abs(r.attention.reduce((a,b)=>a+b,0)-1)<1e-12);assert.deepEqual(r.h,add(r.input,r.a));assert.deepEqual(r.z,add(mat(W1,norm(r.h)),B1));assert.deepEqual(r.activation,r.z.map(gelu));assert.deepEqual(r.f,add(mat(W2,r.activation),B2));assert.deepEqual(r.y,add(r.h,r.f));}
 assert.notDeepEqual(a[0].activation,a[1].activation);assert.notDeepEqual(a[0].y,compute('我 喜欢 杭州',1)[0].y);const n=compute('我 喜欢 杭州',0,false)[0];assert.deepEqual(n.y,n.f);assert.deepEqual(n.h,n.a);
});
test('release countdown requires explicit time; never uses departure',()=>{assert.equal(releaseStatus('').remaining,null);assert.equal(releaseStatus('2026-10-19T10:00',Date.parse('2026-10-19T01:59:50Z')).remaining,10);assert.equal(releaseStatus('2026-10-19T10:00',Date.parse('2026-10-19T02:00:00Z')).remaining,0);assert.equal(releaseStatus('bad').remaining,null)});
test('RFC news dates and ISO instants use Shanghai day, relative dates stay unknown',()=>{assert.equal(isoDay('Sat, 17 Oct 2026 20:38:09 GMT'),'2026-10-18');assert.equal(isoDay('2026-10-17T20:38:09Z'),'2026-10-18');assert.equal(isoDay('3小时前'),null)});
test('exact departure refresh interval handles hour and day rollover',()=>{assert.equal(minuteAfter('12:59'),'13:00');assert.equal(minuteAfter('23:59'),'24:00');assert.equal(minuteAfter('12:00'),'12:01')});
test('dedup preserves provenance, unknown dates stay unknown',()=>{const x=evidenceGroups([{source:'a',title:'标题',url:'https://example.com/x?utm_source=a'},{source:'b',title:'标题',url:'https://example.com/y'},{source:'a',title:'标题',url:'https://example.com/x'}]);assert.equal(x.length,1);assert.equal(x[0].copies,2);assert.equal(x[0].related.length,1);assert.equal(x[0].date,null);assert.equal(isoDay('2026-02-31'),null);assert.equal(isoDay('昨天'),null);assert.deepEqual(countBy(x,'source'),[['a',1]]);assert.equal(canonicalUrl('javascript:alert(1)'), '')});
test('SSE rejects mismatches, errors and incomplete results',async()=>{
 const opts={sessionId:'s',pageId:'p',requestId:'r'};const response=events=>async()=>new Response(events.map(e=>'data: '+JSON.stringify({requestId:'r',pageId:'p',...e})+'\n\n').join(''));
 assert.deepEqual(await invokeTool('t',{}, {...opts,fetcher:response([{type:'result',result:{kind:'json',value:{items:[]}}},{type:'done'}])}),{items:[]});
 await assert.rejects(invokeTool('t',{}, {...opts,fetcher:response([{requestId:'wrong',type:'done'}])}),/标识/);
 await assert.rejects(invokeTool('t',{}, {...opts,fetcher:response([{type:'error',error:'auth required'},{type:'done'}])}),/auth required/);
 await assert.rejects(invokeTool('t',{}, {...opts,fetcher:response([{type:'error',error:'来源需要登录',errorInfo:{code:'AUTH_REQUIRED',detail:'Login wall'}},{type:'done'}])}),e=>e.code==='AUTH_REQUIRED'&&e.message.includes('Login wall'));
 await assert.rejects(invokeTool('t',{}, {...opts,fetcher:response([{type:'result',result:{kind:'json',value:{}}}])}),/完整/);
});
