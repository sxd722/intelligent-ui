import {cp,stat,lstat} from 'node:fs/promises'
import path from 'node:path'
// Preserve confirmations/deduplication history and credentials locally. Never log values.
// Idempotent merge: the destination's newer settings always win.
export async function migrateOpenCliState(previous,current){
 const copied=[]
 for(const name of ['connection.json','capabilities.json','profile','operations']){
  const source=path.join(previous,name),target=path.join(current,name)
  try{await stat(source)}catch(e){if(e.code==='ENOENT')continue;throw e}
  await cp(source,target,{recursive:true,force:false,errorOnExist:false,filter:async p=>!['node_modules','cache','traces'].includes(path.basename(p))&&!(await lstat(p)).isSymbolicLink()});copied.push(name)
 }
 return copied
}
