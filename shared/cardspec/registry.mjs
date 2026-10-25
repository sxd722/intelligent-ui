// One public contract for generation, validation and host rendering.
import { CONTRACTS, capabilityReference, eventSamples, validateContract } from './contracts.mjs'
import {logicJson} from './logic-contract.mjs'
export { capabilityReference, eventSamples, validateContract }
const common = { id: 'id', priority: 'required|supporting|decorative', size: 'small|normal|large', tone: 'default|muted|success|warning|danger|info', visible: 'boolean', grow:'boolean', motion:'none|fade|slide|emphasis',motionKey:'scalar',surface:'plain|soft|outlined|bare' }
const layout = { space: 'tight|normal|loose', align: 'start|center|end|stretch|baseline', justify: 'start|center|end|between', wrap: 'boolean', surface: 'plain|soft|outlined|bare', grow: 'boolean' }
const control = { disabled: 'boolean', label: 'string', onPress: 'action', args: 'json' }
const reg = (props = {}, children = 'flow') => ({ props: { ...common, ...props }, children })
export const REGISTRY = {
  experience:reg({preset:'explore|compare|planner|simulator',label:'string',items:'array',fields:'array',facets:'array',groupBy:'string',titleKey:'string',visual:'list|map',multiple:'boolean',selectedIds:'array',maxSelected:'number',partial:'boolean',onSelect:'action',onApply:'action',applyLabel:'string',args:'json'}),
  map:reg({label:'string',items:'array',selectedId:'scalar',onSelect:'action',args:'json'},'none'),
  sandbox:reg({brief:'string',source:'string',input:'object',initial:'object',actions:'object',height:'number',label:'string'}),
  collection:reg({items:"array",label:"string",titleKey:"string",presentation:"compact|gallery|timeline|poster|folio|spread",revealed:"boolean",timeKey:"string",subtitleKey:"string",fields:"array",groupBy:"string",partial:"boolean",selectedId:"scalar",detailMode:"inline|external",onSelect:"action",args:"json"},"none"),
  logic: reg({initial:'object',input:'object',source:'string',label:'string',tickMs:'number',reactive:'boolean',actions:'object'}),
  countdown: reg({target:'string',label:'string',expiredLabel:'string'},'none'),
  copy: reg({value:'string',label:'string'},'none'),
  heatmap: reg({label:'string',rows:'array',columns:'array',values:'array',selectedRow:'scalar',selectedColumn:'scalar',onSelect:'action',args:'json'},'none'),
  clock: reg({timeZone:'string',label:'string',format:'HH:mm|HH:mm:ss',showDate:'boolean'},'none'),
  slot: reg({label:'string'}),
  region: reg({ ...layout, role: 'summary|content|actions', overflow: 'scroll|paginate|details', label: 'string', resetKey: 'scalar', navigation: 'auto|external', presentation: 'plain|magazine' }),
  stack: reg(layout), box: reg(layout), row: reg(layout),
  grid: reg({ ...layout, columns: 'columns' }), 'grid-item': reg({ ...layout, span: 'columns', rowSpan: 'columns' }),
  title: reg({ align:'start|center|end' }, 'inline'), text: reg({ clamp: 'lines', align:'start|center|end' }, 'inline'), caption: reg({ align:'start|center|end' }, 'inline'),
  strong: reg({}, 'inline'), emphasis: reg({}, 'inline'),
  code: reg({ value:'string', block:'boolean', language:'string' }, 'inline'),
  math: reg({ value:'string', block:'boolean' }, 'none'),
  badge: reg({}, 'inline'), icon: reg({ name: 'string', label: 'string' }, 'none'),
  divider: reg({}, 'none'), spacer: reg({}, 'none'),
  button: reg({ ...control, variant: 'primary|secondary|quiet' }),
  pressable: reg({ ...control, ...layout, selected: 'boolean' }),
  input: reg({ value: 'scalar', label: 'string', placeholder: 'string', inputType: 'text|number|date|time|datetime-local', onChange: 'action', args: 'json', disabled: 'boolean' }, 'none'),
  textarea: reg({ value: 'string', label: 'string', placeholder: 'string', onChange: 'action', args: 'json', disabled: 'boolean' }, 'none'),
  checkbox: reg({ checked: 'boolean', label: 'string', onChange: 'action', args: 'json', disabled: 'boolean' }, 'none'),
  toggle: reg({ checked: 'boolean', label: 'string', onChange: 'action', args: 'json', disabled: 'boolean' }, 'none'),
  chips: reg({ ...layout, label: 'string' }),
  chip: reg({ ...control, selected: 'boolean' }, 'inline'),
  segmented: reg({ value: 'scalar', options: 'array', label: 'string', onChange: 'action', args: 'json' }, 'none'),
  select: reg({ value:'string', options:'array', label:'string', onChange:'action', args:'json', disabled:'boolean' }, 'none'),
  'radio-group': reg({ value:'string', options:'array', label:'string', onChange:'action', args:'json', disabled:'boolean' }, 'none'),
  table: reg({ label:'string', columns:'array', rows:'array', selectedId:'scalar', onSelect:'action', args:'json' }, 'none'),
  popover: reg({ label:'string', open:'boolean', onOpenChange:'action', args:'json' }),
  'swipe-stack': reg({ label:'string', items:'array', index:'number', onSwipe:'action', args:'json', disabled:'boolean', leftLabel:'string', rightLabel:'string' }, 'none'),
  confetti: reg({ trigger:'scalar', label:'string' }, 'none'),
  mermaid: reg({ label:'string', source:'string', selectedId:'scalar', detailMode:'inline|external', onSelect:'action', args:'json' }, 'none'),
  progress: reg({ value: 'number', label: 'string' }, 'none'),
  stats: reg({ columns: 'columns' }), stat: reg({ value: 'scalar', label: 'string' }, 'none'),
  list: reg({ space: 'tight|normal|loose', label:'string' }), 'list-item': reg({...layout,...control}),
  carousel: reg({ label: 'string', index: 'number', onIndexChange: 'action', args: 'json', navigation: 'auto|external' }), 'carousel-item': reg(layout),
  navigation: reg({ target:'id', label:'string' }, 'none'),
  slider: reg({ label: 'string', value: 'number', min: 'number', max: 'number', step: 'number', unit: 'string', disabled: 'boolean', onChange: 'action', args: 'json' }, 'none'),
  mindmap: reg({ label: 'string', nodes: 'array', selectedId: 'scalar', direction: 'horizontal|vertical', detailMode:'inline|external', onSelect: 'action', args: 'json' }, 'none'),
  flowchart: reg({ label: 'string', nodes: 'array', edges: 'array', selectedId: 'scalar', direction: 'horizontal|vertical', detailMode:'inline|external', onSelect: 'action', args: 'json' }, 'none'),
  chart: reg({ label: 'string', kind: 'bar|line|stacked|proportion|comparison', data: 'array', scaleMax:'number', unit: 'string', selectedId: 'scalar', onSelect: 'action', args: 'json' }, 'none'),
  image: reg({ query: 'string', assetRef:'scalar', alt: 'string', mediaRole: 'hero|thumbnail|gallery' }, 'none'),
  link: reg({ url: 'string', label: 'string' }, 'inline'),
  calendar: reg({ month: 'string', selectedDate: 'string', markedDates: 'array', onSelect: 'action', onMonthChange: 'action', args: 'json', label: 'string', navigation: 'auto|external' }, 'none'),
  each: reg({ items: 'array', as: 'id', itemKey: 'scalar' }),
  if: reg({ test: 'boolean' }),
}
for (const [name, def] of Object.entries(REGISTRY)) Object.assign(def, CONTRACTS[name] || {})
export const THEMES = ['editorial', 'soft', 'precision', 'playful', 'dark', 'minimal']
export const STATE_TYPES = ['number', 'string', 'boolean', 'array', 'record']
// Only non-behavioral, static presentation hints have explicit safe defaults.
// Never infer overflow, navigation, action, tool or expression semantics here.
export const LITERAL_PRESENTATION_DEFAULTS=Object.freeze({region:Object.freeze({role:'content'})})
export function checkValue(type, value) {
  if (type === 'json') {try{logicJson(value);return true}catch{return false}}
  if (type === 'id') return typeof value === 'string' && /^[A-Za-z][\w-]{0,63}$/.test(value) && !['constructor', 'prototype', '__proto__'].includes(value)
  if (type === 'action') return typeof value === 'string' && /^[A-Za-z][\w-]{0,63}$/.test(value)
  if (type === 'scalar') return value == null || ['string', 'number', 'boolean'].includes(typeof value)
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value)
  if (type === 'object' || type === 'record') return value !== null && typeof value === 'object' && !Array.isArray(value)
  if (type === 'array') return Array.isArray(value) && value.length <= 1000
  if (type === 'columns') return Number.isInteger(value) && value >= 1 && value <= 12
  if (type === 'lines') return Number.isInteger(value) && value >= 1 && value <= 6
  if (type.includes('|')) return type.split('|').includes(value)
  return typeof value === type
}
export function registryReference({compact=false,names}={}) {
  const describe = (props) => Object.entries(props).map(([k, t]) => `${k}:${({lines:"integer(1–6)",columns:"integer(1–12)"})[t]||t}`).join(' ')
  return `所有组件共有：${describe(common)}\n布局属性组：${describe(layout)}\n` + Object.entries(REGISTRY).filter(([name])=>!names||names.includes(name)).map(([name, def]) => {
    const isLayout = Object.keys(layout).every((key) => key in def.props)
    const own = Object.fromEntries(Object.entries(def.props).filter(([key]) => !(key in common) && !(isLayout && key in layout)))
    return `<${name}> ${isLayout ? '支持布局属性组；' : ''}${describe(own)}; children=${def.children}` +
      (def.required?.length ? `; 必填=${def.required.join(',')}` : '') +
      (!compact && def.purpose ? `; ${def.purpose}` : '') +
      (def.shape ? `; 数据=${def.shape}` : '') +
      (def.events ? `; 事件=${JSON.stringify(def.events)}` : '') +
      (def.behavior && (!compact || ['experience','logic','mermaid','math','swipe-stack','confetti','countdown','copy','heatmap','collection'].includes(name)) ? `; ${def.behavior}` : '') +
      (compact && name==='icon' ? `; ${def.purpose}` : '') +
      ((!compact || name==='logic') && def.example ? `\n例：${def.example}` : '')
  }).join('\n')
}
