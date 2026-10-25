import test from 'node:test'
import assert from 'node:assert/strict'
import { parse, splitCardText } from '../server/compiler/parse.mjs'
import { compile } from '../server/compiler/codegen.mjs'
import { validateDil } from '../server/compiler/validate.mjs'
import { DIL_MULTILINE } from './dil-fixture.mjs'

test('multiline declarations remain data and compile with nested objects, comments and strings', () => {
  const parts = splitCardText(DIL_MULTILINE)
  assert.equal(parts.intro, '商品分类浏览。')
  assert.equal(parts.outro, '点击分类查看对应内容。')
  const parsed = parse(parts.markup)
  assert.equal(parsed.directives.length, 4)
  assert.deepEqual(validateDil(DIL_MULTILINE), [])
  const program = compile(parsed), states = new Map()
  const runtime = {
    jsx: (tag, props, ...children) => ({ tag, props, children }), Fragment:'fragment',
    render: el => { runtime.element = el },
    useConstants: () => program.constants, useAppData: () => ({}),
    useState: (initial, {key}) => [states.get(key) ?? initial, value => states.set(key, value)],
  }
  const run = new Function('DIL', 'AsyncImage', program.code)
  run(runtime)
  assert.match(JSON.stringify(runtime.element), /铅笔/)
  states.set('selected', 'books'); run(runtime)
  assert.match(JSON.stringify(runtime.element), /图册/)
  assert.doesNotMatch(JSON.stringify(runtime.element), /铅笔/)
  states.set('selected', 'empty'); run(runtime)
  assert.match(JSON.stringify(runtime.element), /暂无内容/)
})

test('every streaming prefix keeps unfinished data and nested content inside markup', () => {
  const end = DIL_MULTILINE.lastIndexOf('</box>') + 6
  for (let i = DIL_MULTILINE.indexOf('{@body'); i <= end; i++) {
    const parts = splitCardText(DIL_MULTILINE.slice(0, i))
    assert.equal(parts.outro, '', `source leaked to outro at ${i}`)
    const compiled = compile(parse(parts.markup))
    assert.doesNotThrow(() => new Function('DIL', 'AsyncImage', compiled.code), `invalid program at ${i}`)
    assert.doesNotMatch(compiled.fallbackMarkdown, /categoryId|meta:|\]\}/)
  }
})

test('balanced directives preserve same-line markup, template strings and multiline functions', () => {
  const source = '{@body const format=(v)=>{\n/* } */ return `value: ${v}`\n}}<text>{format(2)}</text>结尾'
  const parts = splitCardText(source)
  assert.equal(parts.outro, '结尾')
  assert.equal(parse(parts.markup).directives.length, 1)
  assert.deepEqual(validateDil(source), [])
  const unfinished = splitCardText('开头\n<box>\n普通文本\n更多文本')
  assert.equal(unfinished.outro, '')
  assert.match(unfinished.markup, /更多文本$/)
})

test('final validation rejects unfinished/invalid/missing cards without executing model code', () => {
  assert.ok(validateDil('{@body const values=[\n{x:1}').some(d=>d.code==='unterminated_braced_value'))
  assert.ok(validateDil('<box><text>内容</text>').some(d=>d.code==='unterminated_tag'))
  assert.ok(validateDil('{@body const values=;}\n<text>内容</text>').some(d=>d.code==='invalid_program'))
  assert.ok(validateDil('只有开场白').some(d=>d.code==='missing_card'))
  assert.deepEqual(validateDil('{@body throw new Error("must not execute")}\n<text>内容</text>'), [])
})
