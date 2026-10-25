import {readFile,writeFile,mkdir,rename,stat} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {homedir} from 'node:os'
import path from 'node:path'
import {TOOLS} from '../../shared/cardspec/tools.mjs'

export function validateDisabledTools(ids){
 if(!Array.isArray(ids)||ids.length>100||ids.some(id=>typeof id!=='string'||TOOLS[id]?.provider!=='opencli'))throw new Error('只能配置已接入的 OpenCLI 工具')
 return [...new Set(ids)].sort()
}
export function createOpenCliSettings(directory){
 let disabled=[],saving=Promise.resolve()
 const file=path.join(directory,'capabilities.json')
 const ready=readFile(file,'utf8').then(text=>{disabled=validateDisabledTools(JSON.parse(text).disabledTools)}).catch(e=>{if(e.code!=='ENOENT')throw new Error('OpenCLI 能力配置无法读取，请检查 capabilities.json')})
 return {
  async get(){await ready;return [...disabled]},
  async set(ids){
   const next=validateDisabledTools(ids)
   const task=saving.catch(()=>{}).then(async()=>{await ready;await mkdir(directory,{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify({disabledTools:next},null,2));await rename(tmp,file);disabled=next;return [...disabled]})
   saving=task;return task
  }
 }
}
export async function inspectOpenCliApp({appDirectory=path.join(process.env.LOCALAPPDATA||path.join(homedir(),'AppData/Local'),'OpenCLIApp'),skillsDirectory=path.join(homedir(),'.claude/skills')}={}){
 let app={installed:false},skills=[]
 try{
  await stat(path.join(appDirectory,'opencli-app.exe'))
  const root=path.join(appDirectory,'node_modules/@jackwener/opencli')
  const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'))
  const manifest=JSON.parse(await readFile(path.join(root,'cli-manifest.json'),'utf8'))
  app={installed:true,runtimeVersion:pkg.version,commandCount:manifest.length}
 }catch{}
 for(const name of ['opencli-usage','opencli-browser','opencli-autofix','opencli-adapter-author','opencli-browser-sitemap','opencli-sitemap-author']){
  try{await stat(path.join(skillsDirectory,name,'SKILL.md'));skills.push(name)}catch{}
 }
 return {...app,skills}
}
export function browserProbeFailure(error){
 const raw=String(error?.message||error).slice(0,700)
 return {ok:false,checkedAt:new Date().toISOString(),error:raw,code:/not supported in Owl/i.test(raw)?'unsupported-browser-host':'browser-probe-failed',message:/not supported in Owl/i.test(raw)?'当前 Owl 环境不支持创建自动化窗口。请在桌面 Chrome 启用 OpenCLI 扩展，并选择它的 profile。':'浏览器实际操作测试未通过；请检查扩展权限或连接后重试。'}
}
