// Create a source-only distribution. Never copy runtime data or Git history.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
const source=process.cwd(), destination=path.resolve(process.argv[2]||'../intelligent-ui-source')
if(fs.existsSync(destination))throw Error('Destination must be new; refusing to overwrite')
if(destination===source||destination.startsWith(source+path.sep))throw Error('Use a sibling export directory')
const dirs=['src','server','shared','tests','scripts','demos','integrations','.trae/skills']
const docs=['CARDSPEC.md','CARDSPEC-ADAPTIVE-HARNESS.md','CARDSPEC-CAPABILITIES-V2.md','CARDSPEC-CAPABILITY-INDEX.md','CARDSPEC-DEBUG-V1.md','CARDSPEC-HANDCRAFTED-BASELINES.md','CARDSPEC-JAVASCRIPT-UPGRADE.md','CARDSPEC-P0-GENERATION-GUARDS.md','CARDSPEC-REACT-SANDBOX.md','DIL-STREAMING.md','FACT-RESEARCH.md','GENERATION-DEBUG-P0.md','GENERATION-SERVICE-AND-CARD-DECK.md','MODEL-PROFILES.md','tool-bindings.md','TOOL-DISCOVERY.md','TOOL-RECOVERY-AND-RESULT-VIEWS.md','WEB-CREATION.md','host-design-templates.md','six-card-design.md','renderer-layout-audit.md','TRAE-WORKBENCH.md','RSI-H5-OPENCLI-BASELINE.md','RSI-H5-BASELINE-V2.md']
const allowed=new Set(['.js','.mjs','.cjs','.jsx','.ts','.tsx','.json','.html','.css','.md','.txt','.py','.ps1','.svg'])
const selected=[]
function walk(rel){for(const entry of fs.readdirSync(path.join(source,rel),{withFileTypes:true})){
 const p=path.posix.join(rel,entry.name)
 if(entry.isSymbolicLink()||/^(node_modules|\.git|\.cache|\.tools|__pycache__|dist|artifacts)$/.test(entry.name))continue
 if(entry.isDirectory())walk(p)
 else if(allowed.has(path.extname(p))&&!/\.(env|pem|key|pfx|p12|log|jsonl)$|(^|\/)(credentials|cookies|storageState|session)[.-].*\.(json|txt)$/i.test(p))selected.push(p)
}}
for(const dir of dirs)walk(dir)
walk('docs/specs')
selected.push(...docs.map(x=>'docs/'+x),'public/opencli-probe.html')
for(const entry of fs.readdirSync(source,{withFileTypes:true}))if(entry.isFile()&&(/\.html$|^playwright.*\.mjs$/.test(entry.name)||['package.json','package-lock.json','vite.config.js','README.md','AGENTS.md'].includes(entry.name)))selected.push(entry.name)
const changes=[]
function sanitize(text){return text
 .replace(/[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s"'`<>]+/gi,'C:/Users/USER')
 .replace(/https?:\/\/[a-z0-9.-]+\.apigateway[-a-z0-9.]*\.volceapi\.com/gi,'https://model-gateway.example.invalid')
 .replace(/https?:\/\/[a-z0-9.-]+\.chatgpt\.site/gi,'https://your-site.example.invalid')
 .replace(/(?:[a-z0-9-]+\.)+[a-z0-9-]+\.ts\.net/gi,'device.tailnet.ts.net')
 .replace(/\b100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}\b/g,'100.64.0.1')
 .replaceAll(os.userInfo().username,'USER')
}
fs.mkdirSync(destination,{recursive:true})
for(const rel of [...new Set(selected)].sort()){
 let raw=fs.readFileSync(path.join(source,rel),'utf8'),text=sanitize(raw)
 if(raw!==text)changes.push(rel)
 fs.mkdirSync(path.dirname(path.join(destination,rel)),{recursive:true});fs.writeFileSync(path.join(destination,rel),text)
}
const ignore=`node_modules/\ndist/\n.cache/\n.tools/\nartifacts/\nsites/\n.env\n.env.*\n!.env.example\n*.env\n*.pem\n*.key\n*.p12\n*.pfx\n*.log\n*.jsonl\n*credentials*.json\n*cookies*.json\n*storageState*.json\nplaywright-report/\ntest-results/\n__pycache__/\n.DS_Store\n/public/*\n!/public/opencli-probe.html\n`
fs.writeFileSync(path.join(destination,'.gitignore'),ignore)
console.log(JSON.stringify({destination,files:new Set(selected).size,anonymizedFiles:changes.length,excluded:['artifacts','public generated outputs except connection-page source','sites','dist','.cache','.tools','node_modules','credentials','existing git history']},null,2))
fs.mkdirSync(path.join(source,'artifacts/github-export'),{recursive:true});fs.writeFileSync(path.join(source,'artifacts/github-export/manifest.json'),JSON.stringify({destination,files:selected,anonymizedFiles:changes},null,2))
