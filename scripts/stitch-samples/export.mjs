import {spawn} from 'node:child_process'
import {readFile,writeFile,mkdir,access,copyFile} from 'node:fs/promises'
import path from 'node:path'
import {setTimeout as delay} from 'node:timers/promises'
const root='artifacts/stitch-samples-20261103',dest='dist/stitch-samples',cli=path.join(process.env.APPDATA,'npm/node_modules/@google/stitch/dist/stitch.js')
const m=JSON.parse(await readFile(root+'/manifest.json','utf8'))
async function call(args){return await new Promise((resolve,reject)=>{let out='',err='';const p=spawn(process.execPath,[cli,...args],{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.on('error',reject);p.on('close',code=>code?reject(Error(err||out)):resolve(out.trim()))})}
await mkdir(dest+'/screens',{recursive:true});await mkdir(dest+'/prompts',{recursive:true})
const records=[]
let previous=[];try{previous=JSON.parse(await readFile(root+'/export.json','utf8'))}catch{}
for(const s of m.screens){if(!s.response?.success||!s.response.data?.id)continue;const id=s.response.data.id,project=m.projects[s.style].id
 for(const ext of ['png','html']){const f=`${root}/screens/${s.id}.${ext}`;try{await access(f)}catch{for(let attempt=0;attempt<3;attempt++){try{await call(['download','screen',id,'--project',project,'--format',ext,'--output',f]);break}catch(e){if(attempt===2||!/50[234]|timeout/i.test(e.message))throw e;await delay(1500*(attempt+1))}}}await copyFile(f,`${dest}/screens/${s.id}.${ext}`)}
 await copyFile(`${root}/${s.prompt}`,`${dest}/${s.prompt}`)
 let link=previous.find(p=>p.id===s.id)?.url||await call(['url','screen',id,'--project',project]);if(link.startsWith('{'))link=JSON.parse(link).data.url;if(!/^https:\/\/stitch\.(google\.com|withgoogle\.com)\//.test(link))throw Error('Unexpected CLI screen URL')
 records.push({id:s.id,style:s.style,title:s.title,tool:s.tool,screenId:id,project,url:link,notes:s.id==='pearl-places'?['Stitch增加了未提供的“展品互动率92%”；地图为示意，不能当真实地理数据。']:[]});console.log(`Exported ${s.id}`)
}
await writeFile(root+'/export.json',JSON.stringify(records,null,2));await writeFile(dest+'/export.json',JSON.stringify(records,null,2));console.log(`Exported ${records.length}/20`)
