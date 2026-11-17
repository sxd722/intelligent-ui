import {createHash} from 'node:crypto'
export function createRepairLimit(maxRepairs=2){
 const accepted=new Set()
 return {
  get repairs(){return Math.max(0,accepted.size-1)},
  canRequest(){return accepted.size<=maxRepairs},
  observe(source){
   if(typeof source!=='string'||!/<card(?:\s|>)/.test(source))return {kind:'not-card-source'}
   const hash=createHash('sha256').update(source).digest('hex')
   if(accepted.has(hash))return {kind:'duplicate',hash}
   if(accepted.size>=maxRepairs+1)return {kind:'limit',hash}
   accepted.add(hash);return {kind:'new',hash}
  }
 }
}
