// Build an isolated, deterministic UI replay. Does not invoke any model/tool.
import {build} from 'esbuild'
import {mkdir,writeFile,copyFile} from 'node:fs/promises'
await mkdir('dist/stream-inspector-qa',{recursive:true})
await build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
import React,{useRef,useState} from 'react';import {createRoot} from 'react-dom/client';
import {Inspector} from './src/StreamInspector.jsx';import {createStreamNarrative} from './src/stream-narrative.mjs';
import './src/styles/tokens.css';import './src/styles/app.css';
const source='<card>\\n'+Array.from({length:100},(_,i)=>'<text>内容 '+i+'</text>').join('\\n')+'\\n</card>';
function Demo(){const n=useRef(createStreamNarrative()),[frames,setFrames]=useState([]);
function replay(){n.current=createStreamNarrative();const rows=[{type:'phase_begin',id:'one',phase:'dsl',title:'生成知识卡'},{p:'',o:'add',v:{message:{reasoning:'',content:{parts:['']}}}},{p:'/message/reasoning',o:'append',v:'## 内容组织\\n**先核实信息**，再生成可交互的结构。\\n- 读取资料\\n- 展示筛选与详情\\n'}];
rows.push({type:'research',status:'running',tool:'cli_read',input:{id:'opencli.example.search',input:{query:'知识'}}},{type:'research',status:'succeeded',tool:'cli_read',contextCharacters:1200});
rows.push({p:'/message/reasoning',o:'append',v:'## 生成实现\\n'});for(let i=0;i<450;i++)rows.push({v:'片段'+i+'：保留已有结构，核验点击反馈。\\n'});
rows.push({p:'/message/content/parts/0',o:'append',v:source},{type:'research_model',model:'QA fixture（非真实调用）',usage:{prompt_tokens:100,completion_tokens:200,total_tokens:300}},{type:'phase_end',status:'succeeded'},{type:'server_ste_metadata',metadata:{total_ms:2400,model_slug:'QA fixture',phases:{dsl:2300}}},{type:'message_stream_complete',status:'succeeded'});
rows.forEach((f,i)=>n.current.push(f,i*10));setFrames(rows.slice(-400))}
function append(){const f={type:'stream_note',note:'实时追加 · '+(frames.length+1)};n.current.push(f,5000+frames.length);setFrames(x=>[...x,f].slice(-400))}
async function real(){const rows=await fetch('./trace.json').then(r=>r.json());n.current=createStreamNarrative();rows.forEach((r,i)=>n.current.push(r.frame||r,r.at??i));setFrames(rows.slice(-400).map(r=>r.frame||r))}
return <div className="app"><main className="chat-side" style={{padding:24}}><h1>Stream 验证</h1><p>流回放；不调用模型、工具或连接。</p><button onClick={replay}>重放长流</button><button onClick={append}>追加事件</button><button onClick={real}>重放真实记录</button></main><div className="inspector"><Inspector frames={frames} narrative={n.current.snapshot()} current={{message:{content:{parts:[source]}}}} exportTrace={()=>{}}/></div></div>}
createRoot(document.getElementById('root')).render(<Demo/>);
`},bundle:true,outfile:'dist/stream-inspector-qa/app.js',format:'esm',define:{'process.env.NODE_ENV':'"production"'}})
await writeFile('dist/stream-inspector-qa/index.html','<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Stream inspector QA</title><link rel="stylesheet" href="./app.css"><div id="root"></div><script type="module" src="./app.js"></script></html>')
await copyFile('artifacts/compact-planner-live-20261029/initial-trace.json','dist/stream-inspector-qa/trace.json')
