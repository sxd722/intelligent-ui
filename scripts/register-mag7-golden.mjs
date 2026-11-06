import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const root='golden-cases',id='mag7-market',version='v1',directory=`cases/${id}/${version}`,dir=`${root}/${directory}`;
const manifest=JSON.parse(await fs.readFile(root+'/manifest.json','utf8'));
if(manifest.cases.some(c=>c.id===id&&c.version===version))throw Error('Already registered; never overwrite an accepted version');
try{await fs.access(dir);throw Error('Snapshot directory already exists')}catch(e){if(e.code!=='ENOENT')throw e}
const qa=JSON.parse(await fs.readFile('artifacts/mag7-stitch/controlled-qa.json','utf8'));
const live=JSON.parse(await fs.readFile('artifacts/mag7-stitch/live-qa.json','utf8'));
const calls=live.trace.filter(t=>t.payload),successful=calls.filter(t=>t.status==='succeeded');
if(!qa.checks.length||!qa.checks.every(c=>c.pass)||calls.length<3||successful.length!==calls.length||live.errors.length)throw Error('Missing successful acceptance evidence');
await fs.cp('dist/mag7-stitch',dir,{recursive:true,filter:source=>path.basename(source)!=='connection-after.json'});
await fs.cp('src/mag7-stitch',dir+'/source',{recursive:true});
await fs.mkdir(dir+'/source/scripts',{recursive:true});
for(const name of ['mag7-build.mjs','mag7-qa.mjs','mag7-live.mjs','mag7-report.mjs','mag7-probe.mjs','mag7-stitch.mjs','mag7-stitch-retry.mjs'])await fs.copyFile('scripts/vision-ab/'+name,dir+'/source/scripts/'+name);
await fs.mkdir(dir+'/source/tool-contracts',{recursive:true});
await fs.copyFile('server/tools/adapters/yahoo-finance.mjs',dir+'/source/tool-contracts/yahoo-finance.mjs');
await fs.copyFile('shared/cardspec/opencli-extensions.mjs',dir+'/source/tool-contracts/opencli-extensions.mjs');
await fs.copyFile('tests/yahoo-finance-adapter.test.mjs',dir+'/source/tool-contracts/yahoo-finance-adapter.test.mjs');
const digest=async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex');
const sourceHashes=Object.fromEntries(await Promise.all(['App.jsx','mag7.css','tool-contracts/yahoo-finance.mjs','tool-contracts/opencli-extensions.mjs'].map(async f=>[f,await digest(dir+'/source/'+f)])));
const record={id,version,title:'MAG7 · 市场观察',subtitle:'真实价格走势、股票切换与渐进新闻',status:'golden',acceptedAt:new Date().toISOString(),acceptedBy:'user',approvalQuote:'great add it to golden cases',artifactHash:createHash('sha256').update(JSON.stringify(sourceHashes)).digest('hex'),sourceHashes,stack:'Stitch + React/H5 + host OpenCLI tools',category:'市场数据与资讯',tags:['真实时序','股票Tabs','自动刷新','实体新闻','渐进详情','状态恢复'],tools:['opencli.eastmoney.quote','opencli.yahoo-finance.chart','opencli.yahoo-finance.news'],directory,liveUrl:'/mag7-stitch/',cover:'live-432.png',coverAlt:'已认可的MAG7卡片：真实NVDA走势、周期选择与来源新闻',description:'股票横向切换联动报价、真实历史曲线和相关新闻；周期切换实际取数，自动更新无需配置。新闻保留来源摘要，详情原地阅读并返回。',strengths:['真实时间戳与价格驱动走势，日涨跌与区间变化分别表达','一张主卡承担七支股票，避免重复面板与工具配置','实体匹配过滤无关新闻，摘要与详情渐进披露','参数缓存、旧响应隔离、失败保留与刷新恢复'],acceptanceScope:{design:'user-approved',interaction:'user-approved; controlled and real-service evidence recorded separately',liveQuotes:'verified',liveHistoricalPrices:'verified',liveNews:'verified'},evidence:{controlledPassed:qa.checks.filter(c=>c.pass).length,controlledTotal:qa.checks.length,widths:[320,360,432],liveCallsPassed:successful.length,liveCallsTotal:calls.length,liveVerified:['七支股票真实报价','AAPL 1日/5日/1月历史查询','NVDA历史与实体相关新闻','新闻详情与返回','刷新恢复所选股票和周期'],pollingVerification:'受控工具与虚拟时钟验证自动轮询、隐藏暂停、失败保留与乱序取消；真实数据另测',layoutMode:'natural-height'},evidenceLinks:[{label:'React源码',path:'source/App.jsx'},{label:'样式',path:'source/mag7.css'},{label:'真实工具trace',path:'live-qa.json'},{label:'浏览器trace',path:'live-browser.zip'},{label:'受控检查',path:'controlled-qa.json'},{label:'根因与实现',path:'report.md'},{label:'收录记录',path:'ACCEPTANCE.md'}],limitations:['宿主联网H5实现，不是纯CardSpec或模型一次生成正确率证据','自然高度卡片，验证320/360/432px宽度，不声称正方形一屏通过','Yahoo公共接口可能变化或限流；东方财富历史连接问题仍存在','报价与历史来自不同服务，可能存在延迟差异；休市时为最近交易时段','新闻摘要为来源原文，不是完整文章或模型生成摘要','冻结UI与源码；实际工具服务、行情与新闻仍随运行环境变化'],trainingApproved:false};
await fs.writeFile(dir+'/case.json',JSON.stringify(record,null,2));
await fs.writeFile(dir+'/ACCEPTANCE.md',`# MAG7 Golden Case v1\n\n用户认可时间：${record.acceptedAt}\n\n用户原话：${record.approvalQuote}\n\n收录范围：已展示的设计、交互与真实数据通道。原 report.html/report.md 是验收前的测试报告，其“候选/待验收”措辞保留为历史证据；当前状态以 case.json 和本记录为准。\n\n真实工具 ${successful.length}/${calls.length}；受控检查 ${record.evidence.controlledPassed}/${record.evidence.controlledTotal}。源码、发布包、Stitch稿、截图与trace冻结；不重新生成模型产物，不自动训练。\n`);
const hashes={};async function walk(relative=''){for(const entry of await fs.readdir(path.join(dir,relative),{withFileTypes:true})){const key=[relative,entry.name].filter(Boolean).join('/');if(entry.isDirectory())await walk(key);else if(key!=='checksums.json')hashes[key]=await digest(path.join(dir,key))}}await walk();
await fs.writeFile(dir+'/checksums.json',JSON.stringify(hashes,null,2));
manifest.cases.push(record);await fs.writeFile(root+'/manifest.json',JSON.stringify(manifest,null,2));
console.log({id,version,frozenFiles:Object.keys(hashes).length,artifactHash:record.artifactHash});
