import {test} from 'node:test'
import {existsSync} from 'node:fs'
import assert from 'node:assert/strict'
import {mkdtemp,rm,mkdir,writeFile,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {createOpenCliSettings,inspectOpenCliApp,browserProbeFailure} from '../server/tools/opencli-settings.mjs'
import {createOpenCli} from '../server/tools/opencli.mjs'
import {TOOLS,selectToolIds,toolReference} from '../shared/cardspec/tools.mjs'
import {migrateOpenCliState} from '../server/tools/opencli-migration.mjs'
import {OPENCLI_PACKAGE,OPENCLI_VERSION} from '../server/tools/opencli.mjs'

test('injected CLI runtime cannot bind or consume the live browser lease',{skip:!existsSync(path.join(OPENCLI_PACKAGE,'package.json'))&&'Optional OpenCLI installation is not included in the source export'},async()=>{
 const cli=createOpenCli({run:async()=>[],restoreHandoff:true})
 try{await assert.rejects(()=>cli.bind(),/Injected CLI runtime/)}finally{cli.close()}
})
test('capability changes persist, reject unregistered tools, and block existing card execution',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'opencli-settings-'));let calls=0
 const cli=createOpenCli({settingsDirectory:dir,run:async()=>{calls++;return []}})
 try{
  await cli.configure(['opencli.wttr.current'])
  assert.deepEqual(await createOpenCliSettings(dir).get(),['opencli.wttr.current'])
  await assert.rejects(()=>cli.invoke('opencli.wttr.current',{location:'Shanghai'},new AbortController().signal),/停用/)
  assert.equal(calls,0)
  assert.equal((await cli.available(TOOLS['opencli.wttr.current'],{disabledTools:['opencli.wttr.current']})).available,false)
  await assert.rejects(()=>cli.configure(['opencli.arbitrary.shell']),/已接入/)
  assert.deepEqual(await createOpenCliSettings(dir).get(),['opencli.wttr.current'])
  await cli.configure([])
  await cli.invoke('opencli.wttr.current',{location:'Shanghai'},new AbortController().signal)
  assert.equal(calls,1)
 }finally{cli.close();await rm(dir,{recursive:true,force:true})}
})
test('desktop detection reads metadata only; Owl failure is distinguished from disconnected transport',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'opencli-detect-')),root=path.join(dir,'node_modules/@jackwener/opencli'),skills=path.join(dir,'skills')
 try{
  await mkdir(root,{recursive:true});await writeFile(path.join(dir,'opencli-app.exe'),'')
  await writeFile(path.join(root,'package.json'),JSON.stringify({version:'1.8.6'}));await writeFile(path.join(root,'cli-manifest.json'),'[{},{}]')
  await mkdir(path.join(skills,'opencli-usage'),{recursive:true});await writeFile(path.join(skills,'opencli-usage/SKILL.md'),'reference')
  assert.deepEqual(await inspectOpenCliApp({appDirectory:dir,skillsDirectory:skills}),{installed:true,runtimeVersion:'1.8.6',commandCount:2,skills:['opencli-usage']})
  assert.equal(browserProbeFailure(Error('Creating browser windows from extensions is not supported in Owl.')).code,'unsupported-browser-host')
  assert.equal(browserProbeFailure(Error('timeout')).code,'browser-probe-failed')
 }finally{await rm(dir,{recursive:true,force:true})}
})
test('1.8.6 contracts match installed adapters; unavailable legacy declarations cannot execute',{skip:!existsSync(path.join(OPENCLI_PACKAGE,'cli-manifest.json'))&&'Optional OpenCLI installation is not included in the source export'},async()=>{
 assert.equal(OPENCLI_VERSION,'1.8.6')
 assert.ok(!selectToolIds(Object.keys(TOOLS),'携程酒店').includes('opencli.ctrip.hotel'))
 assert.ok(!toolReference().includes('"id":"opencli.ctrip.attraction"'))
 const manifest=JSON.parse(await readFile(path.join(OPENCLI_PACKAGE,'cli-manifest.json'),'utf8'))
 const cli=createOpenCli({run:async()=>{throw Error('must not run')}})
 try{for(const t of Object.values(TOOLS).filter(t=>t.provider==='opencli')){
  if(t.unsupportedReason){assert.equal((await cli.available(t,{disabledTools:[]})).available,false);await assert.rejects(()=>cli.invoke(t.id,t.command==='hotel'?{id:'1'}:{city:'1'},new AbortController().signal),/1.8.6 不提供/);continue}
  const entry=manifest.find(x=>x.site===t.site&&x.name===t.command)
  assert.ok(entry,t.id);assert.equal(entry.sourceFile,t.module);assert.deepEqual(t.id==='opencli.12306.trains'?[...entry.columns,'departure_date','bookable']:entry.columns||[],t.columns)
  if(t.browserDocument){assert.equal(t.site,'dongchedi');assert.equal(entry.browser,false);assert.equal(t.browser,true);assert.equal(t.auth,'browser')}
  else assert.equal(entry.browser,t.browser)
 }}finally{cli.close()}
})
test('version migration preserves operation history without overwriting newer settings or copying runtimes',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'opencli-migrate-')),old=path.join(dir,'old'),next=path.join(dir,'next')
 try{
  await mkdir(path.join(old,'operations'),{recursive:true});await mkdir(path.join(old,'profile/.opencli/node_modules'),{recursive:true});await mkdir(next)
  await writeFile(path.join(old,'operations/one.json'),'old operation');await writeFile(path.join(old,'connection.json'),'old connection');await writeFile(path.join(next,'connection.json'),'new connection')
  await writeFile(path.join(old,'profile/.opencli/spotify-tokens.json'),'test-token');await writeFile(path.join(old,'profile/.opencli/node_modules/runtime'),'do not copy')
  await migrateOpenCliState(old,next);await migrateOpenCliState(old,next)
  assert.equal(await readFile(path.join(next,'connection.json'),'utf8'),'new connection');assert.equal(await readFile(path.join(next,'operations/one.json'),'utf8'),'old operation')
  assert.equal(await readFile(path.join(next,'profile/.opencli/spotify-tokens.json'),'utf8'),'test-token');await assert.rejects(()=>readFile(path.join(next,'profile/.opencli/node_modules/runtime')),{code:'ENOENT'})
 }finally{await rm(dir,{recursive:true,force:true})}
})
