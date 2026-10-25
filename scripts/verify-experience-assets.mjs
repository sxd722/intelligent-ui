import {readFile,writeFile} from 'node:fs/promises'
import {toolAssets} from '../server/tools/assets.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
const previous=JSON.parse(await readFile('artifacts/tool-recovery-qa/live.json','utf8'))
const item=previous.find(x=>x.result?.value?.items?.some(r=>r.image_url))?.result.value.items.find(r=>r.image_url)
if(!item)throw Error('No previously verified source image')
const ref=toolAssets.issue(item.image_url),base='http://127.0.0.1:8787/api/tools/assets/',checks=[]
for(const [name,value] of [['signed',ref],['tampered',ref.slice(0,-2)+'zz']]){
 const response=await fetch(base+value,{signal:AbortSignal.timeout(35000)}),bytes=(await response.arrayBuffer()).byteLength
 checks.push({name,status:response.status,bytes,type:response.headers.get('content-type')})
}
const source=`<card schemaVersion="1"><state id="saved" type="boolean" initial={false}/><title>真实素材与观察</title><image assetRef="${ref}" alt="来源提供的电影图片" mediaRole="thumbnail"/><text>图片来自先前工具返回的真实来源；不是生成或搜索替代图。</text><button onPress="save">{state.saved ? "已收藏" : "收藏"}</button><image assetRef={null} alt="暂未提供的素材" mediaRole="thumbnail"/><text>缺失图片保留文字和操作。</text><action id="save"><toggle target="saved"/></action></card>`
const result=compileCard(source,{final:true,cardId:'qa-real-source'})
if(!result.complete)throw Error(JSON.stringify(result.diagnostics))
await writeFile('artifacts/experience-qa/assets.json',JSON.stringify({checks,url:item.image_url},null,2))
await writeFile('artifacts/experience-qa/asset-sample.json',JSON.stringify({blindId:'asset-proof',prompt:'真实来源图片、缺失占位及收藏交互',spec:result.spec,toolValues:{}}))
console.log(JSON.stringify(checks))
