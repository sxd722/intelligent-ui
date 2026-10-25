import fs from 'node:fs/promises';
import path from 'node:path';
export async function check(file){
 const x=JSON.parse(await fs.readFile(file,'utf8')),errors=[];
 for(const k of ['caseId','artifactHash','hostHash','testVersion','mode'])if(!x[k])errors.push('missing '+k);
 if(x.status!=='candidate')errors.push('author delivery must remain candidate');
 const ids=['host-input','core-loop','restore','invalid-state','empty-partial','stale-cancel','local-recovery'];
 const exists=async p=>{if(typeof p!=='string'||!p)return false;try{return (await fs.stat(path.resolve(path.dirname(file),p))).isFile()}catch{return false}};
 for(const id of ids){const c=x.checks?.find(c=>c.id===id);if(!c){errors.push('missing check '+id);continue}if(!['pass','fail','blocked','not_tested'].includes(c.status))errors.push('invalid status '+id);if(c.status==='pass'){for(const k of ['action','expected','actual'])if(!c[k])errors.push(id+' missing '+k);if(!c.evidence?.length)errors.push(id+' missing evidence');for(const p of c.evidence||[])if(!await exists(p))errors.push(id+' absent '+p)}else if(!c.reason)errors.push(id+' missing reason')}
 for(const width of [320,360,432])for(const size of ['square','auto']){const l=x.layouts?.find(l=>l.width===width&&l.size===size);if(!l){errors.push('missing layout '+width+size);continue}if(!await exists(l.screenshot))errors.push('missing screenshot '+width+size);if(!Number.isFinite(l.mainVisiblePx)||typeof l.horizontalOverflow!=='boolean'||typeof l.primaryReachable!=='boolean')errors.push('missing geometry '+width+size)}
 return {recordComplete:errors.length===0,acceptance:'requires independent browser review',errors};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname.replace(/^\/(.:\/)/,'$1'))){const result=await check(process.argv[2]);console.log(JSON.stringify(result,null,2));if(!result.recordComplete)process.exitCode=1}
