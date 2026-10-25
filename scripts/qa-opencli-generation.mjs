import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {EventEmitter} from 'node:events'
import {loadApiKey} from '../server/env.mjs'
import {handleCardSpec} from '../server/cardspec/handler.mjs'
import {TOOLS} from '../shared/cardspec/tools.mjs'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
const expanded=process.argv.includes('--expanded')
const contract=process.argv.includes('--data-contract')
const output=contract?'artifacts/12306-qa-fixed/generated':expanded?'artifacts/opencli-expanded/generated':'artifacts/opencli-qa/generated';await mkdir(output,{recursive:true})
const health=await(await fetch('http://127.0.0.1:8787/api/health')).json(),key=loadApiKey()
if(!key.ok)throw new Error('model key unavailable')
async function streamUpstream(messages,{onPiece,signal,maxTokens,temperature,reasoningEffort,responseFormat}){
 const r=await fetch(health.upstream+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key.value}`},body:JSON.stringify({model:health.model,messages,stream:true,temperature,max_tokens:maxTokens,reasoning_effort:reasoningEffort,...(responseFormat?{response_format:responseFormat}:{})}),signal})
 if(!r.ok)throw new Error(`model HTTP ${r.status}`)
 let buffer='';const decoder=new TextDecoder()
 for await(const chunk of r.body){buffer+=decoder.decode(chunk,{stream:true});let i
  while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i).trim();buffer=buffer.slice(i+1);if(!line.startsWith('data:')||line==='data: [DONE]')continue;const p=JSON.parse(line.slice(5)),c=p.choices?.[0];if(c?.delta)onPiece({content:c.delta.content,reasoning:c.delta.reasoning_content});if(c?.finish_reason==='length'){const e=new Error('model output truncated');e.code='OUTPUT_TRUNCATED';throw e}}
 }
}
const cases=contract?[
 ['trains','展示今日天气和杭州东到上海南下午的车次'],
 ['podcasts','制作苹果播客搜索卡，输入主题，默认历史。用 OpenCLI 搜索真实节目，点击节目读取单集列表。显示加载、空结果和重试。'],
 ['games','制作 Steam 游戏发现卡，搜索默认 Stardew Valley，点击游戏获取详情与价格，不购买。']
]:expanded?[
 ['podcasts','制作苹果播客搜索卡，输入主题，默认历史。用 OpenCLI 搜索真实节目，点击节目读取单集列表。显示加载、空结果和重试。'],
 ['encyclopedia','制作维基百科探索卡，用 OpenCLI 搜索 Moon，选中条目查询摘要，保留搜索输入，不编造返回内容。'],
 ['dictionary','制作单词学习卡，用 OpenCLI 词典查 serendipity，可改词，展示释义和发音。'],
 ['cars','制作汽车之家品牌车型对比卡，输入品牌默认比亚迪，查询真实车型，点击车型查询评分。'],
 ['games','制作 Steam 游戏发现卡，搜索默认 Stardew Valley，点击游戏获取详情与价格，不购买。'],
 ['doubanTop','制作豆瓣 Top250 选片卡，用 opencli.douban.top250 加载前 5 部电影，展示评分，点击电影查看详情，允许刷新。'],
 ['finance','制作东方财富行情查询卡，输入股票代码默认 600519，显示真实报价与更新时间，只读不交易。'],
 ['video','制作 B 站热门视频卡，读取热门列表，用户选择条目后读取视频详情，显示真实播放量和链接。']
]:[
 ['weather','制作真实天气卡，用 OpenCLI 查询上海三日天气，城市可修改，按钮明确叫“查询天气”。不要预填天气。'],
 ['trains','制作火车出行卡，输入出发站、到达站和日期，默认明天上海虹桥到杭州东。用OpenCLI查车次，按钮叫“查询车次”。显示出发时间和二等座余票。不购票。'],
 ['books','制作微信读书搜书卡，输入书名，默认三体，用OpenCLI查书。查询按钮叫“搜索图书”，列表显示书名作者和原文链接。'],
 ['movies','制作豆瓣选片卡，用户输入片名，默认星际穿越，按钮叫“搜索电影”，显示真实查询结果与评分。'],
 ['music','制作Spotify遥控器，歌曲输入默认周杰伦，按钮叫“播放音乐”，调用OpenCLI播放歌曲。写操作只在点击时触发，不轮询。'],
 ['image','制作照片去背景卡，图片URL输入默认https://example.com/photo.jpg，按钮叫“去除背景”，点击时通过OpenCLI去背景。展示返回结果URL。不要自动执行或虚构结果。']
]
const only=process.argv.find(s=>s.startsWith('--only='))?.slice(7)
const summary=only?JSON.parse(await readFile(`${output}/summary.json`,'utf8')).filter(x=>x.id!==only):[]
for(const [id,prompt] of cases.filter(([id])=>!only||only===id)){
 const frames=[],state={},applier=createDeltaApplier(),res=new EventEmitter()
 Object.assign(res,{destroyed:false,writableEnded:false,writeHead(){return this},flushHeaders(){},write(s){for(const line of s.split('\n'))if(line.startsWith('data:')){const raw=line.slice(5).trim();if(raw==='[DONE]')continue;const f=JSON.parse(raw);frames.push(f);if(!isControlEvent(f))applier.apply(state,f)}},end(){this.writableEnded=true}})
 // Only the catalog is a controlled substitute. The GLM request and production
 // compiler/one-repair pipeline are real. No external browser/write tool runs.
 await handleCardSpec({},res,{format:'cardspec',mode:'direct',messages:[{role:'user',content:prompt}]},{streamUpstream,keyLoaded:true,model:health.model,toolCatalog:async()=>Object.values(TOOLS).map(t=>({...t,available:true})),photo:async()=>({status:'error'})})
 const source=state.message?.content?.parts?.[0],spec=state.message?.metadata?.card_spec
 const terminal=frames.findLast(f=>f.type==='message_stream_complete')
 const entry={id,prompt,status:terminal?.status,repairCount:state.message?.metadata?.repair_count||0,tools:Object.values(spec?.bindings||{}).map(b=>b.tool),scope:'real GLM + controlled enabled catalog; external writes not executed'}
 summary.push(entry);await writeFile(`${output}/${id}.json`,JSON.stringify({...entry,source,spec,frames},null,2));await writeFile(`${output}/summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(entry))
}
