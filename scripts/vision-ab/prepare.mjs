import fs from 'node:fs/promises';import {createHash} from 'node:crypto';import {IMAGE_MODEL} from '../../server/image-service.mjs';import {cases,ROOT,DEST} from './cases.mjs';import {build} from 'esbuild';import assert from 'node:assert/strict';import {normalizeMockBounds} from '../../server/design-mock-service.mjs';
assert.deepEqual(normalizeMockBounds({x:'0',y:'0',width:'100',height:'35'}),{x:0,y:0,width:100,height:35});assert.deepEqual(normalizeMockBounds({x:50,y:0,width:50.5,height:35}),{x:50,y:0,width:50,height:35});assert.deepEqual(normalizeMockBounds({x:700,y:0,width:200,height:35}),{x:0,y:0,width:100,height:100});
await fs.mkdir(DEST+'/runs',{recursive:true});
for(const [name,id] of [['greek','9e80a8e0-4279-44d0-870c-a6b1d1f12ae2'],['cthulhu','9d92c2a0-bac1-4f90-8843-3ed1181dab6b'],['antarctic','6dc4f140-3ce4-4e7c-8839-2d09f5a80752']]){
 const r=JSON.parse(await fs.readFile('artifacts/rsi-adaptive/runs/'+id+'.json')),mock=r.artifacts[0].spec.context.designMock;
 const key=createHash('sha256').update(JSON.stringify(['design-mock-v2',IMAGE_MODEL,'gpt-4.1',r.goal.slice(0,3500),'square'])).digest('hex');
 await fs.copyFile('.cache/images/generated/'+mock.id+'.jpg',DEST+'/'+name+'-design.jpg');
 if(key!==mock.id){await fs.copyFile('.cache/images/generated/'+mock.id+'.jpg','.cache/images/generated/'+key+'.jpg');await fs.writeFile('.cache/images/design/'+key+'.json',JSON.stringify({...mock,id:key,url:'/api/media/'+key+'.jpg',comparisonReuseOf:mock.id}));}
}
await build({entryPoints:['scripts/complex-live-cuj/viewer.jsx'],bundle:true,jsx:'automatic',format:'esm',platform:'browser',outfile:DEST+'/viewer.js',define:{'process.env.NODE_ENV':'"production"'},loader:{'.woff2':'file','.ttf':'file','.woff':'file','.png':'file'},logLevel:'error'});
await fs.copyFile('dist/mock-head/viewer.html',DEST+'/viewer.html');console.log('PASS crop normalization; comparison uses identical recorded design images, generation remains live');
