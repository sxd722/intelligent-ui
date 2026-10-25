import {mkdir,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {BASELINE_CARDS} from '../shared/cardspec/baselines/cards.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
const root='public/cardspec-baselines';await mkdir(root,{recursive:true});
const cards=BASELINE_CARDS.map(c=>{
 const compiled=compileCard(c.source,{final:true,context:{localDate:'2026-10-20'}});
 if(!compiled.complete)throw Error(c.id+': '+JSON.stringify(compiled.diagnostics));
 return {...c,sha256:createHash('sha256').update(c.source).digest('hex')};
});
for(const c of cards)await writeFile(root+'/'+c.id+'.cardspec',c.source);
await writeFile('shared/cardspec/baselines/generated.json',JSON.stringify(cards,null,2)+'\n');
await writeFile(root+'/manifest.json',JSON.stringify(cards.map(({source,...c})=>({...c,characters:source.length,url:'/cardspec-baselines/'+c.id+'.cardspec'})),null,2)+'\n');
console.log('Built 5 canonical native CardSpecs (before JS minification)');
