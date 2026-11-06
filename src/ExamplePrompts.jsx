import React from 'react'
import {EXAMPLE_PROMPTS,examplePrompt} from './example-prompts.mjs'

export function ExamplePrompts({onChoose,disabled=false}){
  return <section className="example-prompts" aria-label="场景需求示例">
    <div className="example-heading"><span>从一个完整体验开始</span><small>展开看要求 · 填入后可修改</small></div>
    <div className="example-grid">{EXAMPLE_PROMPTS.map(example=><details className="example-brief" key={example.id}>
      <summary><span className="example-tag">{example.tag}</span><strong>{example.title}</strong><span className="example-description">{example.summary}</span><span className="example-expand">查看用户旅程与设计要求 <span aria-hidden="true">↗</span></span></summary>
      <div className="example-content">
        <p>{example.goal}</p>
        <dl><dt>用户旅程 / CUJ</dt><dd>{example.journey}</dd><dt>视觉与布局</dt><dd>{example.visual}</dd><dt>交互与功能</dt><dd>{example.interaction}</dd></dl>
        <button type="button" className="example-use" disabled={disabled} onClick={()=>onChoose(examplePrompt(example))} aria-label={`使用需求：${example.title}`}>填入这份需求 <span aria-hidden="true">→</span></button>
      </div>
    </details>)}</div>
  </section>
}
