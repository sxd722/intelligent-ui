import {spawn} from 'node:child_process'
import {createInterface} from 'node:readline'
import {writeFile,mkdir} from 'node:fs/promises'
import path from 'node:path'
const root='artifacts/tooling-p0p1-20261103';await mkdir(root,{recursive:true})
const entry=path.join(process.env.APPDATA,'npm/node_modules/@google/stitch/dist/mcp.js')
const child=spawn(process.execPath,[entry],{windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']}),pending=new Map();let seq=0
const timer=setTimeout(()=>{child.kill();process.exitCode=1},60000)
child.stderr.on('data',()=>{})
createInterface({input:child.stdout}).on('line',line=>{try{const v=JSON.parse(line);const p=pending.get(v.id);if(p){pending.delete(v.id);v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result)}}catch{}})
const call=(method,params)=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n')})
try{
 await call('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'cardspec-design-reference',version:'1'}})
 child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n')
 const list=await call('tools/list',{});await writeFile(root+'/stitch-mcp-tools.json',JSON.stringify(list,null,2));console.log(JSON.stringify(list.tools.map(t=>({name:t.name,description:t.description?.slice(0,90)}))))
 if(process.env.STITCH_MCP_TOOL){const result=await call('tools/call',{name:process.env.STITCH_MCP_TOOL,arguments:JSON.parse(process.env.STITCH_MCP_ARGS||'{}')});await writeFile(root+'/stitch-mcp-reference.json',JSON.stringify(result,null,2));console.log('reference saved')}
}finally{clearTimeout(timer);child.kill()}
