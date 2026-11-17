import {mkdir,writeFile} from 'node:fs/promises'
import {sandboxDocument} from '../src/cardspec/sandbox-document.mjs'
const dir='artifacts/full-page-sandbox';await mkdir(dir,{recursive:true})
const doc=sandboxDocument('', 'height-qa')
const html=`<!doctype html><meta charset="utf-8"><title>长页沙箱高度验证</title><style>body{font:16px system-ui;margin:24px;background:#eee}iframe{border:1px solid #bbb;width:320px;display:block;background:white}button{padding:12px}pre{white-space:pre-wrap}</style><h1>严格沙箱 · 内容自适应高度</h1><button id="toggle">切换展开/收起</button><button id="mode">切换完整/固定</button><pre id="status"></pre><iframe sandbox="allow-scripts" style="height:320px"></iframe><script>
const frame=document.querySelector('iframe');let expanded=true,full=true,revision=0,height=320;
const send=x=>frame.contentWindow.postMessage({sandbox:'height-qa',...x},'*');
const render=()=>send({type:'render',revision:++revision,tree:{type:'div',props:{style:{padding:16}},children:[{type:'h2',props:{},children:['交互内容']},...Array.from({length:expanded?18:2},(_,i)=>({type:'p',props:{style:{padding:'18px 0'}},children:['内容行 '+(i+1)+'：长页应由页面统一滚动。']}))]}});
const environment=()=>send({type:'environment',contentHeight:full,active:false,theme:{},motionLevel:'off'});
const status=()=>document.querySelector('#status').textContent=JSON.stringify({mode:full?'full':'fixed',expanded,frameHeight:frame.clientHeight,reported:height},null,2);
addEventListener('message',e=>{if(e.source!==frame.contentWindow||e.data?.sandbox!=='height-qa')return;if(e.data.type==='ready'){environment();render()}if(e.data.type==='content-height'){height=e.data.height;if(full)frame.style.height=height+'px'}status()});
document.querySelector('#toggle').onclick=()=>{expanded=!expanded;render()};document.querySelector('#mode').onclick=()=>{full=!full;frame.style.height=(full?height:320)+'px';environment();status()};frame.srcdoc=${JSON.stringify(doc).replace(/<\/script/gi,'<\\/script')};
</script>`
await writeFile(dir+'/strict.html',html);await mkdir('dist/full-page-sandbox',{recursive:true});await writeFile('dist/full-page-sandbox/strict.html',html)
