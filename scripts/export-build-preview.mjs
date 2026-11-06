// Export an interrupted build without another model call or a false pass claim.
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createBuildWorkspace} from '../server/cardspec/build-workspace.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
const [id,name='build-preview',candidate='latest']=process.argv.slice(2)
if(!/^[a-f0-9-]{36}$/.test(id||'')||!/^[a-z0-9-]+$/.test(name))throw Error('Usage: node scripts/export-build-preview.mjs BUILD_UUID preview-name')
if(!['latest','best'].includes(candidate))throw Error('candidate must be latest or best')
const saved=JSON.parse(await readFile(resolve('artifacts/deep-build',id,candidate==='best'?'best-candidate.json':'trace.json'),'utf8'))
const workspace=createBuildWorkspace({extendedGeneration:true})
workspace.write(Object.entries(saved.workspace).map(([name,f])=>({name,content:f.content})))
const assembled=workspace.assemble()
const result=compileCard(assembled.source,{final:true,context:saved.context||{renderMode:'web',expressionDialect:'js-v1',cardSize:'full',extendedGeneration:true}})
await validateRichContent(result)
if(!result.complete)throw Error(JSON.stringify(result.diagnostics))
const summary={buildId:id,status:'manual-review-required',elapsedMs:saved.elapsedMs,coverage:saved.coverage,feedback:saved.feedback,version:assembled.version,exportedAt:new Date().toISOString()}
const html=`<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>候选试玩 · 自动调试已停止</title>
<style>body{margin:0;background:#171a20;color:#e3e7ef;font:15px system-ui}main{max-width:720px;margin:30px auto;padding:20px}h1{font-size:23px}p{line-height:1.7;color:#b8c1d0}a{color:#acd2ff}iframe{display:block;border:0;width:100%;height:780px;max-width:432px;margin:24px auto;border-radius:20px;background:#eceff3}button{padding:10px 18px;border:0;border-radius:12px;background:#d6e6fc;cursor:pointer;margin-right:8px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}</style>
<main><h1>候选试玩 · 自动调试已停止</h1><p>这是最后一次已提交的实现，未经完整验收。保留原始布局与逻辑，便于直接判断实际体验；没有继续修复或生成。此预览不调用模型，工具使用隔离测试数据。</p>
<button id="small">320px</button><button id="large">432px</button><a href="candidate.cardspec" download>原始 CardSpec</a> · <a href="summary.json">验收记录</a>
<iframe id="preview" src="/card-debug.html" title="候选交互卡片"></iframe><p id="status">正在载入现有代码…</p><details><summary>剩余问题</summary><pre id="issues"></pre></details></main>
<script type="module">const frame=document.querySelector('#preview'),status=document.querySelector('#status');const spec=await fetch('./spec.json').then(r=>r.json());const report=await fetch('./summary.json').then(r=>r.json());document.querySelector('#issues').textContent=JSON.stringify({coverage:report.coverage,feedback:report.feedback},null,2);
async function mount(width){while(!frame.contentWindow.cardDebug)await new Promise(r=>setTimeout(r,100));frame.contentWindow.cardDebug.save();frame.style.maxWidth=width+'px';frame.contentWindow.cardDebug.mount(spec,{width,size:'full',restore:true,persistenceKey:'manual-'+report.buildId});status.textContent='已载入。可直接操作；当前候选未宣称通过全部需求。'}
document.querySelector('#small').onclick=()=>mount(320);document.querySelector('#large').onclick=()=>mount(432);await mount(432);</script></html>`
for(const base of ['artifacts','dist']){const dir=resolve(base,name);await mkdir(dir,{recursive:true});await Promise.all([writeFile(resolve(dir,'index.html'),html),writeFile(resolve(dir,'spec.json'),JSON.stringify(result.spec)),writeFile(resolve(dir,'candidate.cardspec'),assembled.source),writeFile(resolve(dir,'summary.json'),JSON.stringify(summary,null,2))])}
console.log(JSON.stringify({url:'http://127.0.0.1:8787/'+name+'/',version:assembled.version,status:summary.status}))
