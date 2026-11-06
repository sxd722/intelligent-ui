import React from 'react'
import {Markdown} from './md.jsx'
import {readableOutput} from './stream-narrative.mjs'

export function StreamCot({narrative}){
  const {entries=[],model,status,dropped=0}=narrative||{}
  return <div className="stream-cot">
    <p className="cot-note">展示流中实际返回的推理文本、模型输出及工具活动；未返回的信息不补写。耗时标为“接收间隔”时是浏览器观测值。</p>
    {(model||status)&&<div className="cot-summary">{model} {status&&` · ${status}`}</div>}
    {!!entries.length&&!entries.some(e=>e.usage||e.kind==='metrics'&&e.text.includes('tokens'))&&<p className="cot-note">当前流未提供 token 用量。</p>}
    {!!dropped&&<p className="cot-note">已省略最早 {dropped} 条记录，完整帧可导出。</p>}
    {!entries.length&&<p>等待生成事件…</p>}
    {entries.map(e=><section key={e.id} className={`cot-entry cot-entry--${e.kind}`}>
      <header><strong>{e.title}</strong><span>+{(e.at/1000).toFixed(1)}s{e.status&&` · ${e.status}`}</span></header>
      {(e.elapsedMs!=null||e.usage||e.kind==='model')&&<small className="cot-cost">{e.elapsedMs!=null?`${e.estimated?'接收间隔':'耗时'} ${(e.elapsedMs/1000).toFixed(2)}s · `:''}{e.usage||(e.kind==='model'?'token 用量未提供':'')}</small>}
      {e.kind==='output'?/^\s*(?:<|```(?:xml|html|jsx|javascript))/.test(e.text)?<details><summary>实现源码 · {e.text.length.toLocaleString()} 字符</summary><pre>{e.text}</pre></details>:<Markdown text={readableOutput(e.text)}/>:e.text?<Markdown text={e.kind==='plan'?readableOutput(e.text):e.text}/>:null}
      {e.text.length>=100000&&<small>展示达到长度上限，完整内容见 Source / 导出。</small>}
    </section>)}
  </div>
}
