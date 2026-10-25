import {readFile,writeFile} from 'node:fs/promises'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {TOOL_DEMO} from '../shared/cardspec/tool-fixtures.mjs'
import {normalizeFeed} from '../server/tools/autocli.mjs'
const sample={blindId:'session-proof',prompt:'页面与 slot 状态保留检查（工具替身）',spec:compileCard(TOOL_DEMO,{final:true,cardId:'experience-qa-session',context:{generationMode:'experience'}}).spec,toolValues:{'autocli.hackernews.top':normalizeFeed('autocli.hackernews.top',[{title:'固定工具替身',author:'QA',score:1,url:'https://example.org/'}])}}
await writeFile('artifacts/experience-qa/session-sample.json',JSON.stringify(sample))
const pack=JSON.parse(await readFile('public/experience-qa-samples.json','utf8')).filter(x=>x.blindId!==sample.blindId);pack.push(sample)
await writeFile('public/experience-qa-samples.json',JSON.stringify(pack))
