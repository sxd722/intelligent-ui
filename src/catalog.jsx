// Component catalog — every DIL host component with name, DSL, schema,
// a live demo rendered by the REAL runtime, and its measured footprint
// normalized to the square-card standard (100u × 100u, 1u = 1% of the side;
// measured at the 432px reference stage → 1u = 4.32px).
import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { HOST_COMPONENTS, AsyncImage } from './dil/components.jsx'
import { AppDataContext } from './dil/runtime.jsx'
import './styles/tokens.css'
import './styles/dil.css'
import './styles/themes.css'
import './styles/catalog.css'

const H = HOST_COMPONENTS
const GridItem = H["grid-item"]
const ListItem = H["list-item"]
const RadioOption = H["radio-option"]
const CarouselItem = H["carousel-item"]
const U = 4.32 // px per unit at the 432px reference card

// ---------------------------------------------------------------- schemas

const S = (prop, type, note) => ({ prop, type, note })

const SPECS = [
  // ---------- 布局 ----------
  {
    name: 'box', group: '布局', what: '纵向堆叠容器（卡片默认骨架）',
    dsl: `<box gap={2} padding={3} background="surface" radius="2xl">\n  …children…\n</box>`,
    schema: [
      S('direction', '"col"|"row"', '默认 col'), S('gap', 'number', '间距，单位 = --spacing'),
      S('padding', 'number', '内边距'), S('background', 'token | #hex', 'surface 系/语义色'),
      S('radius', '"sm"…"3xl"|"full"', '圆角'), S('align / justify', 'start|center|end|between', '对齐'),
      S('flex / width / height', 'number|"px"|"%"', '尺寸'), S('border / shadow / clip', 'boolean', '描边/阴影/裁切'),
    ],
    demo: (
      <H.box gap={1.5} padding={2} background="surface-secondary" radius="lg">
        <H.text size="xs">子元素 1</H.text>
        <H.text size="xs">子元素 2</H.text>
      </H.box>
    ),
    size: '弹性（由内容决定）',
  },
  {
    name: 'row', group: '布局', what: '横向排列容器',
    dsl: `<row justify="between" align="center" gap={2}>\n  …children…\n</row>`,
    schema: [S('justify', 'start|center|end|between|around', '主轴对齐'), S('align', 'start|center|end', '交叉轴对齐'), S('gap', 'number', '间距')],
    demo: (
      <H.row justify="between" align="center">
        <H.text size="xs" weight="medium">左</H.text>
        <H.text size="xs" color="secondary">右</H.text>
      </H.row>
    ),
    size: '弹性（横向一行）',
  },
  {
    name: 'card', group: '布局', what: ' elevated 卡片（自带底色/圆角/阴影）',
    dsl: `<card padding={3}>\n  …内容…\n</card>`,
    schema: [S('继承 box 全部属性', '—', '默认 background=surface-elevated、radius=3xl、shadow')],
    demo: (
      <H.card padding={2}>
        <H.text size="xs">卡内内容</H.text>
      </H.card>
    ),
    size: '弹性',
  },
  {
    name: 'grid + grid-item', group: '布局', what: '二维网格（清单/图组自动打包的基础）',
    dsl: `<grid columns={2} gap={2}>\n  <grid-item>…</grid-item>\n</grid>`,
    schema: [S('columns', 'number | "sm"(2) | "md"(3) | "lg"(4)', '列数'), S('gap / rowGap / columnGap', 'number', '间距'), S('span (grid-item)', 'number', '跨列')],
    demo: (
      <H.grid columns={3} gap={1.5}>
        {[1, 2, 3].map((i) => (
          <GridItem key={i}>
            <H.box background="surface-secondary" radius="md" align="center" padding={1}>
              <H.text size="2xs">{i}</H.text>
            </H.box>
          </GridItem>
        ))}
      </H.grid>
    ),
    size: '≈100u 宽；行高由内容定',
  },
  {
    name: 'divider', group: '布局', what: '分隔线',
    dsl: `<divider/>`,
    schema: [S('size', '"1px"|"2px"', '线宽；随主题变虚线/发丝线')],
    demo: (
      <H.box gap={1}>
        <H.text size="2xs" color="secondary">上方</H.text>
        <H.divider />
        <H.text size="2xs" color="secondary">下方</H.text>
      </H.box>
    ),
    size: '≈100u × 0.25u',
  },
  {
    name: 'spacer', group: '布局', what: '弹性占位（推开兄弟元素）',
    dsl: `<spacer/>`,
    schema: [S('minSize', 'number', '最小占位')],
    demo: (
      <H.row>
        <H.text size="xs">左</H.text>
        <H.spacer />
        <H.text size="xs">右</H.text>
      </H.row>
    ),
    size: '弹性',
  },

  // ---------- 文本 ----------
  {
    name: 'text', group: '文本', what: '正文段落（层级只靠 size 档位）',
    dsl: `<text size="xs" color="secondary" weight="medium" align="center">文字</text>`,
    schema: [
      S('size', '"3xs"|"2xs"|"xs"|"sm"|"md"|"lg"|"xl"', '字级（随引擎 --font-scale 缩放）'),
      S('weight', 'normal|medium|semibold|bold', '字重'), S('color', '语义色', 'secondary/tertiary/…'),
      S('align', 'start|center|end', '对齐'), S('inline', 'boolean', '行内'),
    ],
    demo: (
      <H.box gap={0.5}>
        <H.text size="md" weight="bold">md bold 主文</H.text>
        <H.text size="xs" color="secondary">xs secondary 辅助说明</H.text>
        <H.text size="2xs" color="tertiary">2xs tertiary 脚注</H.text>
      </H.box>
    ),
    size: '行高 ≈ 3–6u/行',
  },
  {
    name: 'title', group: '文本', what: '标题（衬线/描边等由主题语言决定）',
    dsl: `<title size="xl">卡片标题</title>`,
    schema: [S('size', '"sm"|"md"|"lg"|"xl"|"2xl"', '默认 md；xl=卡标题'), S('color / align', '—', '同 text')],
    demo: <H.title size="lg">标题 lg</H.title>,
    size: '行高 ≈ 7–9u',
  },
  {
    name: 'caption', group: '文本', what: '短元信息（不换行、不挤压）',
    dsl: `<caption>3月12日 · 周三</caption>`,
    schema: [S('size', '"sm"|"md"', '默认 xs'), S('color', '语义色', '默认 secondary')],
    demo: <H.caption>0/8 · 已喝 0 杯</H.caption>,
    size: '≈8–30u × 3u',
  },
  {
    name: 'label', group: '文本', what: '表单标签',
    dsl: `<label size="sm">喝水目标</label>`,
    schema: [S('size', '"sm"|"md"', ''), S('htmlFor', 'string', '关联表单 id')],
    demo: <H.label size="sm">喝水目标</H.label>,
    size: '≈20–40u × 4u',
  },
  {
    name: 'bold / italic / underline', group: '文本', what: '行内强调',
    dsl: `<bold>粗</bold> <italic>斜</italic> <underline>下划线</underline>`,
    schema: [S('（无属性）', '—', '行内使用，可混排 markdown **粗体**')],
    demo: (
      <H.text size="xs">
        <H.bold>粗体</H.bold> · <H.italic>斜体</H.italic> · <H.underline>下划线</H.underline>
      </H.text>
    ),
    size: '随所在文本行',
  },
  {
    name: 'icon', group: '视觉', what: '线条图标（24 种内置）',
    dsl: `<icon name="droplet" size="md" color="info"/>`,
    schema: [S('name', 'sprout leaf droplet sun moon star heart clock …', '见 icons.jsx'), S('size', '"xs"…"xl" | px', ''), S('color', '语义色', '')],
    demo: (
      <H.row gap={1.5} align="center">
        {['droplet', 'sun', 'moon', 'heart', 'star', 'check'].map((n) => (
          <H.icon key={n} name={n} size="md" color="info" />
        ))}
      </H.row>
    ),
    size: '≈4u × 4u/枚',
  },
  {
    name: 'badge', group: '视觉', what: '徽章/状态胶囊',
    dsl: `<badge>3月12日 · 周三</badge>`,
    schema: [S('color', 'primary|secondary|success|danger|warning', '默认 secondary'), S('weight', 'normal|medium|semibold|bold', ''), S('pill', 'boolean', '默认 true')],
    demo: (
      <H.row gap={1.5}>
        <H.badge>默认</H.badge>
        <H.badge color="success">success</H.badge>
        <H.badge color="danger">danger</H.badge>
      </H.row>
    ),
    size: '≈14–40u × 5u',
  },
  {
    name: 'progress', group: '视觉', what: '进度条',
    dsl: `<progress value={done/8}/>` ,
    schema: [S('value', '0–1', ''), S('color', 'success|primary|danger|warning', '默认 success'), S('height', 'px', '默认 8')],
    demo: <H.progress value={0.625} />,
    size: '≈100u × 2u',
  },
  {
    name: 'rating', group: '视觉', what: '评分点（引擎定径）',
    dsl: `<rating value={4}/>` ,
    schema: [S('value', 'number', '点亮数'), S('max', 'number', '默认 5')],
    demo: <H.rating value={4} />,
    size: '≈12u × 2u',
  },

  // ---------- 交互 ----------
  {
    name: 'button', group: '交互', what: '按钮',
    dsl: `<button onClick={()=>setDone(true)}>完成打卡</button>`,
    schema: [S('color', 'primary|secondary|success|danger|warning', '默认 primary'), S('variant', '"solid"|"outline"', ''), S('size', '"sm"|"md"|"lg"', ''), S('block / pill / disabled', 'boolean', ''), S('onClick', '() => void', '')],
    demo: (
      <H.row gap={1.5}>
        <H.button size="sm">主要</H.button>
        <H.button size="sm" variant="outline" color="secondary">描边</H.button>
      </H.row>
    ),
    size: '≈18–45u × 7–9u',
  },
  {
    name: 'pressable', group: '交互', what: '任意可点区域（水滴格/卡位）',
    dsl: `<pressable onClick={()=>tick(i)}>\n  <icon name="droplet"/>\n</pressable>`,
    schema: [S('onClick', '() => void', ''), S('disabled / inline / ariaLabel', '—', '')],
    demo: (
      <H.row gap={1.5}>
        {[0, 1, 2].map((i) => (
          <H.pressable key={i} onClick={() => {}}>
            <H.box background="surface-secondary" radius="full" align="center" justify="center" width={22} height={22}>
              <H.text size="2xs">{i + 1}</H.text>
            </H.box>
          </H.pressable>
        ))}
      </H.row>
    ),
    size: '随内容（常 ≈5–6u 方格）',
  },
  {
    name: 'checkbox', group: '交互', what: '勾选项（自动划线完成态）',
    dsl: `<checkbox checked={c[i]} onChange={(v)=>set(i,v)}>第1杯</checkbox>`,
    schema: [S('checked', 'boolean', ''), S('onChange', '(v:boolean) => void', ''), S('children', 'string', '标签（nowrap+省略）')],
    demo: (
      <H.box gap={1}>
        <H.checkbox checked onChange={() => {}}>已喝</H.checkbox>
        <H.checkbox onChange={() => {}}>未喝</H.checkbox>
      </H.box>
    ),
    size: '≈100u × 6u/行',
  },
  {
    name: 'input', group: '交互', what: '单行输入',
    dsl: `<input value={v} onChange={setV} placeholder="记点什么…"/>`,
    schema: [S('value / onChange', 'string', ''), S('placeholder', 'string', ''), S('type', '"text"|"number"', ''), S('pill / block', 'boolean', '')],
    demo: <H.input placeholder="记点什么…" />,
    size: '≈100u × 9u',
  },
  {
    name: 'textarea', group: '交互', what: '多行输入',
    dsl: `<textarea rows={3} value={note} onChange={setNote}/>` ,
    schema: [S('rows', 'number', '默认 3'), S('value / onChange / placeholder', '—', '同 input')],
    demo: <H.textarea rows={2} placeholder="观察记录…" />,
    size: '≈100u × 18u（rows=2）',
  },

  // ---------- 数据选择 ----------
  {
    name: 'chips + chip', group: '选择', what: '筛选标签（引擎排成二维网格）',
    dsl: `<chips>\n  <chip selected={f===0} onClick={()=>setF(0)}>全部</chip>\n</chips>`,
    schema: [S('selected', 'boolean', 'chip 高亮'), S('onClick', '() => void', ''), S('（chips 容器无属性）', '—', '列宽/字号由引擎 --u-chip-* 推导')],
    demo: (
      <H.chips>
        {['全部', '碳酸', '茶饮'].map((c, i) => (
          <H.chip key={c} selected={i === 0} onClick={() => {}}>{c}</H.chip>
        ))}
      </H.chips>
    ),
    size: '≈100u × 8u/行',
  },
  {
    name: 'radio + radio-option', group: '选择', what: '分段控件（单选，横排一行）',
    dsl: `<radio>\n  <radio-option selected={s===0} onClick={()=>setS(0)}>按甜度</radio-option>\n</radio>`,
    schema: [S('selected', 'boolean', ''), S('onClick', '() => void', ''), S('（高度由引擎 --u-radio-h 推导）', '—', '')],
    demo: (
      <H.radio>
        <RadioOption selected onClick={() => {}}>按甜度</RadioOption>
        <RadioOption onClick={() => {}}>按气泡</RadioOption>
      </H.radio>
    ),
    size: '≈100u × 7u',
  },
  {
    name: 'carousel + carousel-item', group: '选择', what: '横滑浏览（item 宽高由引擎按数量推导）',
    dsl: `<carousel>\n  <carousel-item>\n    <AsyncImage query="…" aspectRatio="1:1"/>\n    <title size="sm">名字</title>\n  </carousel-item>\n</carousel>`,
    schema: [S('（无属性）', '—', 'item 宽 ≈ 卡宽 46–74%（按同级数量），高 ≈ 19–24% 边长，可横滑')],
    demo: (
      <H.carousel>
        {['🌀', '🍵', '🚀'].map((e, i) => (
          <CarouselItem key={i}>
            <H.box background="surface-secondary" radius="md" align="center" justify="center" height={60}>
              <H.text size="lg">{e}</H.text>
            </H.box>
            <H.text size="2xs">条目 {i + 1}</H.text>
          </CarouselItem>
        ))}
      </H.carousel>
    ),
    size: '≈100u × 22u（3 项时）',
  },
  {
    name: 'stats + stat', group: '选择', what: '页头指标条（多列网格）',
    dsl: `<stats>\n  <stat value="0/8" label="已喝(杯)"/>\n</stats>`,
    schema: [S('value', 'string | number', '大数字'), S('label', 'string', '小标（省略号）')],
    demo: (
      <H.stats>
        <H.stat value="0/8" label="已喝(杯)" />
        <H.stat value="0%" label="完成度" />
        <H.stat value={8} label="剩余" />
      </H.stats>
    ),
    size: '≈100u × 10u',
  },

  // ---------- 列表 / 媒体 ----------
  {
    name: 'list + list-item', group: '列表', what: '条目列表（4+ 项自动两列网格）',
    dsl: `<list>\n  <list-item marker="bullet" description="说明">条目</list-item>\n</list>`,
    schema: [S('marker', '"bullet"|…', '行首标记'), S('description', 'string', '次行说明')],
    demo: (
      <H.list>
        <ListItem description="6:30–8:00">起床后补水</ListItem>
        <ListItem description="9:30–11:30">工作间隙</ListItem>
      </H.list>
    ),
    size: '≈100u × 12u（2 项）',
  },
  {
    name: 'AsyncImage', group: '媒体', what: '异步图片（服务端 Pexels 解析，流式占位）',
    dsl: `<AsyncImage query="glass of water splash" aspectRatio="3:1"/>`,
    schema: [
      S('query', 'string（英文）', 'Pexels 检索词，服务端解析'),
      S('aspectRatio', '"w:h"', '如 3:1 扁横幅 / 1:1 方图'),
      S('width / radius / fit', '—', '覆盖默认'),
      S('渲染特例', '—', '卡片根下的直接子节点=顶格全出血横幅（上清下透 mask）'),
    ],
    demo: (
      <AsyncImageMemo />
    ),
    size: '根直下：100u × 15–19u（引擎）；其余按 aspectRatio',
  },
]

// AsyncImage demo with a fake resolved appData so it shows a real photo
function AsyncImageMemo() {
  const appData = {
    opGenui: {
      componentResults: {
        demo: {
          status: 'resolved',
          componentName: 'AsyncImage',
          state: {
            is_loading: false,
            images: [{
              url: 'https://images.pexels.com/photos/10415537/pexels-photo-10415537.jpeg?auto=compress&cs=tinysrgb&w=640',
              content_url: 'https://images.pexels.com/photos/10415537/pexels-photo-10415537.jpeg?auto=compress&cs=tinysrgb&w=640',
              thumbnail_url: 'https://images.pexels.com/photos/10415537/pexels-photo-10415537.jpeg?auto=compress&cs=tinysrgb&w=320',
              title: 'water glass',
            }],
          },
        },
      },
      modelDataBindings: {},
    },
  }
  return (
    <AppDataContext.Provider value={appData}>
      <AsyncImage __resolutionId="demo" aspectRatio="3:1" />
    </AppDataContext.Provider>
  )
}

// ---------------------------------------------------------------- page

const GROUPS = ['布局', '文本', '视觉', '交互', '选择', '列表', '媒体']
const THEMES = [
  ['editorial', 'a'], ['soft', 'a'], ['precision', 'a'],
  ['playful', 'a'], ['dark', 'a'], ['minimal', 'a'],
]

function SpecCard({ spec, theme, palette }) {
  const ref = useRef(null)
  const [size, setSize] = useState(null)
  useEffect(() => {
    const measure = () => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      if (r.width < 2) return
      setSize({
        w: Math.round((r.width / U) * 10) / 10,
        h: Math.round((r.height / U) * 10) / 10,
        area: Math.round(((r.width / U) * (r.height / U)) / 10) * 10 / 100,
      })
    }
    // measure after fonts/images settle, then a couple of decayed retries
    const t1 = setTimeout(measure, 300)
    const t2 = setTimeout(measure, 1200)
    const t3 = setTimeout(measure, 3000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [theme, palette])

  return (
    <section className="spec">
      <header className="spec-head">
        <span className="spec-name">{spec.name}</span>
        <span className="spec-group">{spec.group}</span>
        <span className="spec-what">{spec.what}</span>
        <span className="spec-size" title="在 432px 基准卡实测，1u = 卡边 1%">
          {size ? `≈ ${size.w}u × ${size.h}u · 占卡 ${size.area}%` : '测量中…'}
          {!/^≈|弹性|随|行高/.test(spec.size) ? '' : ` · ${spec.size}`}
        </span>
      </header>
      <div className="spec-body">
        <div className="spec-stage-wrap">
          <div className="dil-stage spec-stage" data-theme={theme} data-palette={palette}>
            <div className="dil-card">{spec.demo}</div>
          </div>
          <div className="spec-measure" ref={ref} aria-hidden="true">
            <div className="dil-card">{spec.demo}</div>
          </div>
        </div>
        <div className="spec-docs">
          <pre className="spec-dsl">{spec.dsl}</pre>
          <table className="spec-schema">
            <thead><tr><th>属性</th><th>类型</th><th>说明</th></tr></thead>
            <tbody>
              {spec.schema.map((s, i) => (
                <tr key={i}><td>{s.prop}</td><td>{s.type}</td><td>{s.note}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function Catalog() {
  const [theme, setTheme] = useState('playful')
  const [palette, setPalette] = useState('a')
  return (
    <div className="catalog">
      <header className="cat-head">
        <h1>DIL 组件目录</h1>
        <p>
          共 {SPECS.length} 个组件条目。尺寸按<b>正方形卡片 100u × 100u</b> 标准换算：
          渲染引擎在 432px 基准卡上实测每个 demo 的占位，1u = 卡边 1% = 4.32px。
          尺寸由本地自动布局引擎决定，模型只输出语义 DSL（零尺寸、零颜色）。
        </p>
        <div className="cat-themes">
          {THEMES.map(([t, p]) => (
            <button key={t} className={`cat-theme${theme === t ? ' on' : ''}`} onClick={() => { setTheme(t); setPalette(p) }}>
              {t}
            </button>
          ))}
        </div>
      </header>
      {GROUPS.map((g) => {
        const list = SPECS.filter((s) => s.group === g)
        if (!list.length) return null
        return (
          <div key={g}>
            <h2 className="cat-group">{g}</h2>
            {list.map((s) => <SpecCard key={s.name} spec={s} theme={theme} palette={palette} />)}
          </div>
        )
      })}
      <footer className="cat-foot">
        demo 由真实运行时组件渲染（与生成卡同一套代码）；「弹性」= 尺寸由内容与引擎决定。
        <a href="/">← 返回应用</a>
      </footer>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<Catalog />)
