import {spawn} from 'node:child_process'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import path from 'node:path'
const root='artifacts/stitch-samples-20261103'
const cli=path.join(process.env.APPDATA,'npm/node_modules/@google/stitch/dist/stitch.js')
const manifest=JSON.parse(await readFile(root+'/manifest.json','utf8'))
let writes=Promise.resolve()
const save=()=>{const snapshot=JSON.stringify(manifest,null,2);return writes=writes.then(()=>writeFile(root+'/manifest.json',snapshot))}
async function call(args,file){const start=Date.now();const result=await new Promise((resolve,reject)=>{let stdout='',stderr='';const p=spawn(process.execPath,[cli,...args],{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);p.on('error',reject);p.on('close',code=>resolve({code,stdout,stderr,elapsedMs:Date.now()-start}));});await writeFile(`${root}/${file}`,JSON.stringify(result,null,2));if(result.code)throw Error(`Stitch exit ${result.code}; inspect ${file}`);try{return JSON.parse(result.stdout)}catch{return {text:result.stdout}}}
await mkdir(root+'/trace',{recursive:true});await mkdir(root+'/screens',{recursive:true})
const selected=process.argv[2]
async function runStyle(style){
 if(!manifest.projects[style]){const r=await call(['create','project','--title',`Tool Cards 20 · ${style} · 20261103`,'--json'],`trace/create-${style}.json`);if(!r.success||!r.data?.id)throw Error('Unexpected create response');manifest.projects[style]={id:r.data.id};await save()}
 const project=manifest.projects[style].id
 for(const screen of manifest.screens.filter(s=>s.style===style)){
  if(screen.status!=='pending')continue
  screen.status='generating';screen.startedAt=new Date().toISOString();await save()
  console.log(`Generating ${screen.id} in ${project}`)
  try{const r=await call(['generate','screen','--project',project,'--prompt',await readFile(`${root}/${screen.prompt}`,'utf8'),'--device','AGNOSTIC','--model','GEMINI_3_8_FLASH','--json'],`trace/${screen.id}.json`);screen.response=r;screen.status='generated-awaiting-export';screen.finishedAt=new Date().toISOString();await save();console.log(`Generated ${screen.id}`)}catch(e){screen.status='needs-inspection';screen.error=e.message;await save();throw e}
  if(process.argv.includes('--one'))break
 }
}
const todo=['pearl','atlas','field','persona'].filter(s=>!selected||selected===s)
await Promise.all(Array.from({length:Math.min(2,todo.length)},async()=>{while(todo.length)await runStyle(todo.shift())}))
manifest.status=manifest.screens.every(s=>s.status!=='pending'&&s.status!=='generating')?'generated-awaiting-review':'in-progress';await save()

