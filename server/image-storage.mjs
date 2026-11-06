import {mkdir,readFile,writeFile,rename} from 'node:fs/promises'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
export function diskImageStorage(root){
 const file=key=>{if(!/^(generated|pexels|design)\/[a-f0-9]{64}\.(jpg|json)$/.test(key))throw Error('invalid cache key');return path.join(root,key)}
 return {read:async key=>{try{return await readFile(file(key))}catch(e){if(e.code==='ENOENT')return null;throw e}},write:async(key,bytes)=>{const target=file(key),tmp=target+'.'+randomUUID()+'.tmp';await mkdir(path.dirname(target),{recursive:true});await writeFile(tmp,bytes);await rename(tmp,target)}}
}
