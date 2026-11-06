import {mkdir,writeFile} from 'node:fs/promises'

import {compileCard} from '../../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../../server/cardspec/rich-validation.mjs'
import {cases,source,envelope,ROOT,DEST} from './cases.mjs'
await mkdir(ROOT,{recursive:true});await mkdir(DEST+'/runs',{recursive:true})
for(const c of cases)for(const mode of ['native','hybrid']){
 const id=c.id+'-'+mode,src=source(c,mode),r=compileCard(src,{final:true,cardId:id,context:{expressionDialect:'js-v1',renderMode:mode}})
 await validateRichContent(r)
 if(!r.complete||r.diagnostics.some(d=>d.severity==='error'))throw Error(id+': '+JSON.stringify(r.diagnostics))
 r.spec.prefetched=[{id:'D1',tool:c.tool,input:c.input,value:envelope(c.rows),updatedAt:'2026-11-03T02:00:00Z'}]
 if(c.id==='feed')r.spec.prefetched.push({id:'D2',tool:c.secondary.tool,input:c.secondary.input,value:envelope(c.secondary.rows),updatedAt:'2026-11-03T02:00:00Z'})
 if(c.id==='trip')r.spec.prefetched.push({id:'D3',tool:'opencli.wttr.forecast',input:{location:'Hangzhou',days:3},value:envelope([{date:'2026-11-04',description:'多云',avgTempC:18},{date:'2026-11-05',description:'雨',avgTempC:15}]),updatedAt:'2026-11-03T02:00:00Z'})
 await writeFile(ROOT+'/'+id+'.cardspec',src);await writeFile(DEST+'/runs/'+id+'.json',JSON.stringify({id,case:c.id,mode,spec:r.spec}));console.log(id+' compiled')
}

