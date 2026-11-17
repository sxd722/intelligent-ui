// Explicit publication only. Retains cloud adaptations and exports a small public study bundle.
import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
const root=process.cwd(),site=path.join(root,'sites/intelligent-ui-next-20261109')
const mirror=path.resolve('../intelligent-ui-source'),staging=path.resolve('../intelligent-ui-export-20261117-study')
const audit=path.join(root,'artifacts/publication-20261117');fs.mkdirSync(audit,{recursive:true})
const changed=JSON.parse(fs.readFileSync('artifacts/github-export/study-changed-files.json'))
const mutations=[]
for(const rel of changed){
 const targets=rel.startsWith('src/')?['ui/'+rel]:rel.startsWith('shared/')?[rel,'ui/'+rel]:rel.startsWith('server/cardspec/')&&rel!=='server/cardspec/debug-browser.mjs'?[rel]:[]
 for(const dest of targets){
  const target=path.join(site,dest),current=fs.existsSync(target)?fs.readFileSync(target):null,newFile=path.join(root,rel),base=path.join(mirror,rel)
  let content=fs.readFileSync(newFile)
  const resolved=path.join(audit,'resolved',dest)
  if(fs.existsSync(resolved))content=fs.readFileSync(resolved)
  else if(current&&fs.existsSync(base)){
   const inputs=[target,base,newFile].map((file,i)=>{
    const temp=path.join(audit,'merge-'+i+'.mjs');fs.writeFileSync(temp,fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'));return temp
   })
   const merged=spawnSync('git',['merge-file','-p',...inputs],{encoding:'utf8',maxBuffer:16*1024*1024,windowsHide:true})
   if(merged.status!==0){fs.writeFileSync(path.join(audit,dest.replaceAll('/','_')+'.conflict'),merged.stdout||merged.stderr);throw Error('Cloud merge requires review: '+dest)}
   content=Buffer.from(merged.stdout)
  }
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);mutations.push(dest)
 }
}
// Export reviewed documents and only the deterministic fixtures needed by source tests.
const study='experiments/round1-20261117'
const fixtures=['common-calibration/before/debug-assertions.mjs',...['01','02','03','04','05'].map(n=>'runs/screen-01-recording-kit-V1-r2/source-versions/'+n+'.cardspec')]
const docs=['decisions.md','method-audit.md','BASELINE.md','REPRODUCE.md','confirmation-independent-review.md','combo-independent-review.md','round-accounting.md','conditions-exposure-audit.md']
const scrub=s=>s.replace(/[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s"'`<>]+/gi,'C:/Users/USER').replace(/https?:\/\/[a-z0-9.-]+\.apigateway[-a-z0-9.]*\.volceapi\.com/gi,'https://model-gateway.example.invalid')
for(const rel of [...fixtures,...docs.map(x=>x),...['screen.json','oracles.json','confirm.json','oracles-confirm.json','combo.json','oracles-combo.json','combo-frozen-hashes.json'].map(x=>'tasks/'+x)]){
 const src=path.join(root,study,rel);if(!fs.existsSync(src))throw Error('Missing allowlisted fixture/doc '+rel)
 const dest=path.join(staging,study,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,scrub(fs.readFileSync(src,'utf8')))
}
fs.writeFileSync(path.join(staging,study,'PUBLICATION.md'),'# Public subset\n\nSource and reviewed findings are published. Raw requests, private trace, credentials, runtime caches, archives and sealed holdout tasks are intentionally not included. Reproduction of historical runs needs the private local evidence bundle; the source tests have their minimal deterministic fixtures here. No experiment was promoted to the normal generation default.\n')
// The report is already a reviewed public subset; scrub machine paths again for hosting.
function copyReport(dir,rel=''){
 for(const e of fs.readdirSync(dir,{withFileTypes:true})){
  if(e.isSymbolicLink())throw Error('No symlinks in report')
  const p=path.join(rel,e.name),src=path.join(dir,e.name),dest=path.join(site,'ui/public/exploration-round1',p)
  if(e.isDirectory())copyReport(src,p)
  else{fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,/\.(json|js|html|css|md)$/.test(p)?scrub(fs.readFileSync(src,'utf8')):fs.readFileSync(src))}
 }
}
copyReport(path.join(root,'public/exploration-round1'))
const lab=fs.readFileSync(path.join(site,'ui/cardspec-lab.html'),'utf8')
fs.writeFileSync(path.join(site,'ui/card-debug.html'),lab.replace('/src/cardspec/lab.jsx','/src/card-debug.jsx'))
const vite=path.join(site,'ui/vite.config.js'),v=fs.readFileSync(vite,'utf8')
if(!v.includes("cardDebug:resolve('card-debug.html')"))fs.writeFileSync(vite,v.replace("input:{main:","input:{cardDebug:resolve('card-debug.html'),main:"))
fs.writeFileSync(path.join(audit,'scope.json'),JSON.stringify({site,mutations,report:'public/exploration-round1',rawRequestsPublished:false,holdoutPublished:false,normalDefaultsChanged:false,preservedCloudBrowserStub:true},null,2))
console.log(JSON.stringify({mergedFiles:mutations.length,publicFixtures:fixtures.length,docs:docs.length,cloudEnginePreserved:true}))
