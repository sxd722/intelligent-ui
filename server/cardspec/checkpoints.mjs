import {mkdir,readFile,writeFile,readdir,unlink} from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
const root=path.resolve('artifacts/generation-checkpoints'),ttl=15*60*1000
const key=goal=>createHash('sha256').update(goal).digest('hex')
const valid=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id)
export async function saveCheckpoint(id,goal,records,{directory=root,now=Date.now()}={}){
 if(!valid(id))throw Error('Invalid checkpoint ID')
 const value={version:1,goalHash:key(goal),createdAt:now,expiresAt:now+ttl,records}
 const text=JSON.stringify(value);if(text.length>320000)throw Error('Checkpoint exceeds data budget')
 await mkdir(directory,{recursive:true})
 // No recursive deletion and no paths from file content.
 const files=(await readdir(directory)).filter(validFile=>/^[a-f0-9-]{36}\.json$/.test(validFile))
 let active=0
 for(const file of files){try{const old=JSON.parse(await readFile(path.join(directory,file),'utf8'));if(old.expiresAt<now)await unlink(path.join(directory,file));else active++}catch{}}
 if(active>=64)return false
 await writeFile(path.join(directory,id+'.json'),text)
 return true
}
export async function loadCheckpoint(id,goal,{directory=root,now=Date.now()}={}){
 if(!valid(id))return null
 try{
  const raw=await readFile(path.join(directory,id+'.json'),'utf8');if(raw.length>320000)return null
  const v=JSON.parse(raw)
  if(v.version!==1||v.goalHash!==key(goal)||v.expiresAt<=now||v.createdAt>now||!Array.isArray(v.records)||v.records.length>40)return null
  return v
 }catch{return null}
}
