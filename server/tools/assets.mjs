import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto'
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {toolMediaPolicy} from '../../shared/cardspec/tool-media.mjs'
let secret
function signingKey(){
 if(secret)return secret
 const dir=fileURLToPath(new URL('../../.cache/',import.meta.url)),file=path.join(dir,'tool-assets.key')
 mkdirSync(dir,{recursive:true});try{secret=readFileSync(file)}catch(e){if(e.code!=='ENOENT')throw e;try{writeFileSync(file,randomBytes(32),{flag:'wx',mode:0o600})}catch(e){if(e.code!=='EEXIST')throw e}secret=readFileSync(file)}
 return secret
}
export function createAssetIssuer(key){
 const mac=value=>createHmac('sha256',key||signingKey()).update(value).digest('base64url')
 const issue=url=>{const policy=toolMediaPolicy(url);if(!policy)return null;const data=Buffer.from(policy.url).toString('base64url');return 'asset.v1.'+data+'.'+mac(data)}
 function resolve(ref){
  if(typeof ref!=='string'||ref.length>3000)throw Error('invalid asset reference')
  const parts=ref.split('.');if(parts.length!==4||parts[0]!=='asset'||parts[1]!=='v1')throw Error('invalid asset reference')
  const expected=Buffer.from(mac(parts[2])),actual=Buffer.from(parts[3]);if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error('unsigned asset reference')
  const policy=toolMediaPolicy(Buffer.from(parts[2],'base64url').toString('utf8'));if(!policy)throw Error('unsupported asset source');return policy.url
 }
 function attach(value,depth=0){
  if(depth>10||!value||typeof value!=='object')return value
  if(Array.isArray(value))return value.map(x=>attach(x,depth+1))
  const copy=Object.fromEntries(Object.entries(value).filter(([k])=>k!=='assetRef'&&k!=='assetKind').map(([k,v])=>[k,attach(v,depth+1)]))
  for(const field of ['image','imageUrl','image_url','poster','posterUrl','poster_url','thumbnail','thumbnailUrl','cover','cover_url']){const ref=issue(value[field]);if(ref){copy.assetRef=ref;copy.assetKind='source-image';break}}
  return copy
 }
 return {issue,resolve,attach}
}
export const toolAssets=createAssetIssuer()
