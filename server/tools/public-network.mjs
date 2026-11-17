import {readFileSync} from 'node:fs'
import path from 'node:path'

// Optional maintainer configuration, outside generated source and prompts.
// Applied only inside public-HTTP adapter workers, never to Owl or model calls.
export function applyPublicProxy(directory,env=process.env){
 let config;try{config=JSON.parse(readFileSync(path.join(directory,'network.json'),'utf8'))}catch(e){if(e.code==='ENOENT')return false;throw e}
 if(!config.publicProxy)return false
 const url=new URL(config.publicProxy)
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Invalid public adapter proxy configuration')
 env.HTTPS_PROXY=url.origin;env.HTTP_PROXY=url.origin
 env.NO_PROXY=[env.NO_PROXY,'localhost','127.0.0.1','::1'].filter(Boolean).join(',')
 return true
}

export function publicNetworkOptions(directory){try{const c=JSON.parse(readFileSync(path.join(directory,'network.json'),'utf8'));return {systemTls:c.transport==='system-tls',proxy:c.publicProxy}}catch(e){if(e.code==='ENOENT')return {};throw e}}
