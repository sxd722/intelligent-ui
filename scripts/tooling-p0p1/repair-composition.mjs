import {readFile,writeFile} from 'node:fs/promises'
import {build} from 'esbuild'
import {createModelClient} from '../../server/research/model-client.mjs'
import {loadApiKey} from '../../server/env.mjs'
import {compileCard} from '../../shared/cardspec/compiler.mjs'
const dir='artifacts/tooling-p0p1-20261103/complex',dest='dist/tooling-p0p1/complex',trace=JSON.parse(await readFile(dir+'/feed-trace.json','utf8')),r=JSON.parse(await readFile(dest+'/feed.json','utf8'))
const messages=[...trace.at(-1).messages,{role:'assistant',content:r.source},{role:'user',content:'浏览器发现：仅选择已合并条目就重新搜索并覆盖原来源，破坏完整候选集合。本任务只是合并两处已有内容，pick仅更新选中状态；保留两个来源、来源筛选、详情和返回。请完整输出修复card。'}]
const key=loadApiKey(),round=createModelClient({base:process.env.MODEL_BASE_URL||'https://model-gateway.example.invalid/v1',key:key.value,model:'deepseek-v4-flash'}),start=Date.now(),response=await round(messages,{maxTokens:3000,thinking:{type:'disabled'},signal:AbortSignal.timeout(60000)})
const compiled=compileCard(response.message.content,{final:true,cardId:'live-feed',context:{expressionDialect:'js-v1'}});await writeFile(dir+'/feed-repair-trace.json',JSON.stringify({messages,response,elapsedMs:Date.now()-start},null,2));if(!compiled.complete)throw Error(JSON.stringify(compiled.diagnostics));compiled.spec.prefetched=r.spec.prefetched;r.source=response.message.content;r.spec=compiled.spec;r.repairMs=Date.now()-start;await writeFile(dest+'/feed.json',JSON.stringify(r))
await build({entryPoints:['scripts/tooling-p0p1/real-viewer.jsx'],bundle:true,format:'esm',platform:'browser',outfile:dest+'/viewer.js',define:{'process.env.NODE_ENV':'"production"'},loader:{'.woff2':'file','.ttf':'file','.woff':'file','.png':'file'},logLevel:'error'})
console.log('feed repaired; rebuilt shared runtime for all three')
