import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const root='golden-cases',id='election-desk',version='v1',directory=`cases/${id}/${version}`,dir=`${root}/${directory}`;
const manifest=JSON.parse(await fs.readFile(root+'/manifest.json','utf8'));
if(manifest.cases.some(c=>c.id===id&&c.version===version))throw Error('Already registered; do not overwrite an accepted version');
try{await fs.access(dir);throw Error('Snapshot directory already exists')}catch(e){if(e.code!=='ENOENT')throw e}
const qa=JSON.parse(await fs.readFile('artifacts/election-stitch/controlled-qa.json','utf8'));
const live=JSON.parse(await fs.readFile('artifacts/election-stitch/live-browser.json','utf8'));
if(!qa.checks.every(c=>c.pass)||live.trace.filter(t=>t.status==='succeeded').length<2)throw Error('Missing expected acceptance evidence');
await fs.cp('dist/election-stitch',dir,{recursive:true});
await fs.cp('src/election-stitch',dir+'/source',{recursive:true});
for(const file of ['election-build.mjs','election-map.mjs','election-qa.mjs','election-live.mjs','election-report.mjs','election-stitch.mjs','election-investigate.mjs']){
 await fs.mkdir(dir+'/source/scripts',{recursive:true});await fs.copyFile('scripts/vision-ab/'+file,dir+'/source/scripts/'+file);
}
const digest=async f=>createHash('sha256').update(await fs.readFile(f)).digest('hex');
const sourceHashes=Object.fromEntries(await Promise.all(['App.jsx','election.css','states.json'].map(async f=>[f,await digest(dir+'/source/'+f)])));
const record={id,version,title:'美国中期选举 · Election Desk',subtitle:'真实州界、共享状态与紧凑新闻看板',status:'golden',priority:'low',priorityLabel:'低优先级',priorityReason:'时效性强；所需实时计票可能不在现有CLI能力范围内。优先复用设计与交互，不作为当前工具覆盖的核心回归项。',acceptedAt:new Date().toISOString(),acceptedBy:'user',approvalQuote:'ok，我觉得可以验收通过，加入golden case。这个时效性过强的需求，确实可能在cli中找不到工具候选。在golden case里给这个case标记一下低优先级。',artifactHash:createHash('sha256').update(JSON.stringify(sourceHashes)).digest('hex'),sourceHashes,stack:'Stitch + React/H5 + host news tools',category:'时效资讯与地理可视化',tags:['低优先级','真实州界','院别联动','自动刷新','单一状态','紧凑信息'],tools:['opencli.google.news'],directory,liveUrl:'/election-stitch/',cover:'live-sample-432.png',coverAlt:'已认可的选情卡：真实州界、合成交互计票样本与真实新闻',description:'地图、院别统计和唯一州详情共享状态；新闻初载与每五分钟自动读取。缺少实时计票源时显示未知，显式开启样本后检查红蓝地图联动。',strengths:['真实州界成为主视觉，减少重复信息和内层滚动','院别切换联动地图、样本统计、州详情与新闻查询','新闻自动更新、失败保留、隐藏暂停和刷新恢复','计票、新闻和交互样本分别处理，未知值不伪装为结果'],acceptanceScope:{design:'user-approved',interaction:'user-approved with controlled election fixtures',liveNews:'verified',liveElectionResults:'not-integrated'},evidence:{controlledPassed:qa.checks.filter(c=>c.pass).length,controlledTotal:qa.checks.length,widths:[320,360,432],liveVerified:['Google News首次参议院新闻查询','Google News切换众议院新闻查询'],additionalProbes:['opencli.bbc.topic'],pollingVerification:'浏览器虚拟时钟加速300秒，工具替身验证调度与失败；真实新闻另测'},evidenceLinks:[{label:'React源码',path:'source/App.jsx'},{label:'样式',path:'source/election.css'},{label:'真实调用记录',path:'live-browser.json'},{label:'浏览器trace',path:'live-browser.zip'},{label:'受控检查',path:'controlled-qa.json'},{label:'设计与根因文档',path:'DESIGN.md'}],limitations:['实时州级计票源尚未接入；红蓝与票数仅为显式开启的合成交互样本，默认显示未知','新闻查询不是计票接口，不能从新闻条目数推断领先席位','用户认可的是设计与交互，不代表全美实时选情功能已完整实现','时效性强，数据接口与来源需要使用时重新验证','不是纯CardSpec或模型一次生成成功率证据；未修复全局规划和上下文污染','冻结UI与源码；宿主工具及实时新闻仍会变化'],trainingApproved:false};
await fs.writeFile(dir+'/case.json',JSON.stringify(record,null,2));
const hashes={};async function walk(relative=''){for(const entry of await fs.readdir(path.join(dir,relative),{withFileTypes:true})){const key=[relative,entry.name].filter(Boolean).join('/');if(entry.isDirectory())await walk(key);else if(key!=='checksums.json')hashes[key]=await digest(path.join(dir,key))}}await walk();
await fs.writeFile(dir+'/checksums.json',JSON.stringify(hashes,null,2));
manifest.cases.push(record);await fs.writeFile(root+'/manifest.json',JSON.stringify(manifest,null,2));
console.log({id,version,priority:record.priority,frozenFiles:Object.keys(hashes).length,artifactHash:record.artifactHash});
