// Small streaming-friendly markdown renderer for phase documents
// (headings, lists, bold/italic/inline-code, code fences, hr, paragraphs).

import React from 'react'

function inline(text, keyBase = 'i') {
  const nodes = []
  let buf = ''
  let i = 0
  const push = (node) => {
    if (buf) {
      nodes.push(buf)
      buf = ''
    }
    nodes.push(node)
  }
  while (i < text.length) {
    if (text.startsWith('**', i)) {
      const end = text.indexOf('**', i + 2)
      if (end !== -1) {
        push(<strong key={`${keyBase}-b${i}`}>{text.slice(i + 2, end)}</strong>)
        i = end + 2
        continue
      }
    }
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1)
      if (end !== -1) {
        push(<code key={`${keyBase}-c${i}`}>{text.slice(i + 1, end)}</code>)
        i = end + 1
        continue
      }
    }
    buf += text[i]
    i++
  }
  if (buf) nodes.push(buf)
  return nodes
}

export function Markdown({ text = '', light = false }) {
  const blocks = []
  const lines = text.split('\n')
  let list = null // {ordered, items}
  let fence = null // {lang, lines}

  const flushList = () => {
    if (!list) return
    const Tag = list.ordered ? 'ol' : 'ul'
    blocks.push(
      <Tag key={`l${blocks.length}`}>
        {list.items.map((item, i) => (
          <li key={i}>{inline(item, `li${i}`)}</li>
        ))}
      </Tag>
    )
    list = null
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    if (fence) {
      if (/^```/.test(line)) {
        blocks.push(
          <pre key={`f${blocks.length}`}>
            <code>{fence.lines.join('\n')}</code>
          </pre>
        )
        fence = null
      } else {
        fence.lines.push(raw)
      }
      continue
    }
    if (/^```/.test(line)) {
      flushList()
      fence = { lang: line.slice(3), lines: [] }
      continue
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line)
    if (bullet) {
      if (!list || list.ordered) {
        flushList()
        list = { ordered: false, items: [] }
      }
      list.items.push(bullet[1])
      continue
    }
    const numbered = /^\d+[.、]\s+(.*)$/.exec(line)
    if (numbered) {
      if (!list || !list.ordered) {
        flushList()
        list = { ordered: true, items: [] }
      }
      list.items.push(numbered[1])
      continue
    }
    flushList()
    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    if (h) {
      const Tag = ['h1', 'h2', 'h3', 'h4'][h[1].length - 1]
      blocks.push(<Tag key={`h${blocks.length}`}>{inline(h[2], `h${blocks.length}`)}</Tag>)
      continue
    }
    if (/^---+\s*$/.test(line)) {
      blocks.push(<hr key={`r${blocks.length}`} />)
      continue
    }
    if (line.trim() === '') continue
    blocks.push(<p key={`p${blocks.length}`}>{inline(line, `p${blocks.length}`)}</p>)
  }
  flushList()
  if (fence) {
    blocks.push(
      <pre key={`f${blocks.length}`}>
        <code>{fence.lines.join('\n')}</code>
      </pre>
    )
  }
  return <div className={`phase-md${light ? ' phase-md--light' : ''}`}>{blocks}</div>
}
