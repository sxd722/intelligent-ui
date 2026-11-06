import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {generateCard} from '../../server/cardspec/generation.mjs';
const run=JSON.parse(await fs.readFile('artifacts/mock-head-20261103/greek.json'));
for(const [enabled,profile,expected] of [[true,'default',true],[false,'default',false],[true,'deepseek-flash',false]]){
 let calls=0;
 const designMock=async()=>run.spec.context.designMock;
 designMock.imageInput=async()=>({type:'image_url',image_url:{url:'data:image/jpeg;base64,dGVzdA==',detail:'high'}});
 await generateCard({input:{prompt:'展示一个简短标题'},view:{designMode:'image-first',designImageInput:enabled,modelProfile:profile},photo:{designMock},signal:new AbortController().signal,streamUpstream:async(messages,options)=>{
  calls++;
  assert.equal(messages.some(m=>Array.isArray(m.content)&&m.content.some(p=>p.type==='image_url')),expected);
  assert(!messages.filter(m=>typeof m.content==='string').some(m=>m.content.includes('base64')));
  if(expected)assert.equal(options.modelOverride,'glm-5.3-flash');
  assert(messages.some(m=>typeof m.content==='string'&&m.content.includes('不要默认用mockTile')));
  options.onPiece({content:'<card schemaVersion="1"><title id="title">测试标题</title></card>'});
 }});
 assert(calls>0);
}
console.log('PASS generation image enabled/disabled/profile isolation; metadata excludes image bytes; image sourcing prompt');
