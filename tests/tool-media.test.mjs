import {test} from 'node:test'
import assert from 'node:assert/strict'
import https from 'node:https'
import {EventEmitter} from 'node:events'
import {Readable} from 'node:stream'
import {createToolMediaService,publicMediaIP} from '../server/tools/media.mjs'
import {toolMediaPolicy,toolMediaSrc} from '../shared/cardspec/tool-media.mjs'
import {resultImageSources,detailRequests} from '../shared/cardspec/result-view.mjs'
const thumb='https://img3.doubanio.com/view/photo/m/public/p123.webp'
const full='https://img3.doubanio.com/view/photo/l/public/p123.webp'
const webp=Buffer.from('RIFF1234WEBPtest')

test('source policies restrict upstream paths and prefer observed thumbnails without rewriting image IDs',()=>{
 assert.equal(toolMediaPolicy(thumb).referer,'https://movie.douban.com/')
 for(const url of ['http://img3.doubanio.com/view/photo/m/public/p123.webp',thumb+'?redirect=http://127.0.0.1',thumb+'#x',thumb.replace('img3.','evil.img3.'),thumb.replace('doubanio.com','doubanio.com.evil.com'),thumb.replace('img3.','user@img3.'),'https://127.0.0.1/p123.webp','https://img3.doubanio.com/admin'])assert.equal(toolMediaPolicy(url),null,url)
 assert.deepEqual(resultImageSources({thumb_url:thumb,image_url:full}),[toolMediaSrc(thumb),toolMediaSrc(full)])
 assert.equal(detailRequests('opencli.douban.top250',{id:'42'})[1].input.type,'R')
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','::1','::ffff:127.0.0.1','fc00::1','2001:db8::1'])assert.equal(publicMediaIP(ip),false,ip)
 assert.equal(publicMediaIP('8.8.8.8'),true)
})
test('media loads coalesce, cache expires, failures back off and capacity stays bounded',async()=>{
 let time=0,calls=0,finish;const service=createToolMediaService({now:()=>time,maxEntries:1,load:()=>{calls++;return new Promise(r=>finish=r)}})
 const a=service.get(thumb),b=service.get(thumb);assert.equal(calls,1);finish({body:webp,type:'image/webp'});await Promise.all([a,b]);await service.get(thumb);assert.equal(calls,1)
 time=900001;const c=service.get(thumb);finish({body:webp,type:'image/webp'});await c;assert.equal(calls,2)
 const d=service.get(full);finish({body:webp,type:'image/webp'});await d
 const e=service.get(thumb);assert.equal(calls,4);finish({body:webp,type:'image/webp'});await e
 let failures=0;const bad=createToolMediaService({now:()=>time,load:async()=>{failures++;throw Error('418')}})
 await assert.rejects(bad.get(thumb));await assert.rejects(bad.get(thumb));assert.equal(failures,1)
 time+=30001;await assert.rejects(bad.get(thumb));assert.equal(failures,2)
 await assert.rejects(bad.get('https://localhost/foo'));assert.equal(failures,2)
})
test('transport sets fixed source headers, rejects redirects, nonimages and oversized responses',async t=>{
 let response={statusCode:200,headers:{},body:webp},seen=[]
 t.mock.method(https,'get',(url,options,callback)=>{
  seen.push({url,options});const req=new EventEmitter();req.destroy=e=>{req.emit('error',e);req.emit('close')}
  process.nextTick(()=>{const res=Readable.from([response.body]);Object.assign(res,{statusCode:response.statusCode,headers:response.headers});res.on('close',()=>req.emit('close'));callback(res)})
  return req
 })
 assert.equal((await createToolMediaService().get(thumb)).type,'image/webp')
 assert.deepEqual(seen[0].options.headers,{Referer:'https://movie.douban.com/',Accept:'image/webp,image/png,image/jpeg'})
 response={statusCode:302,headers:{location:'http://127.0.0.1/'},body:Buffer.from('redirect')}
 await assert.rejects(createToolMediaService().get(thumb),/302/);assert.equal(seen.length,2)
 response={statusCode:200,headers:{},body:Buffer.from('<svg>bad</svg>')};await assert.rejects(createToolMediaService().get(thumb),/Unsupported/)
 response={statusCode:200,headers:{},body:Buffer.alloc(100)};await assert.rejects(createToolMediaService({maxBytes:16}).get(thumb),/size limit/)
})
