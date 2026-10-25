import {compositionReference} from './compositions.mjs'
// Curated DESIGN.md translations, not a runtime Markdown/CSS execution surface.
// Material still comes from visualStyle; recipes own color and type hierarchy.
const sans = 'Inter, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
const recipe = (label, description, material, scheme, colors, type, effect = 'none') => Object.freeze({
  label, description, material, scheme,
  effect,
  tokens: Object.freeze({
    '--cs-ink': colors.ink, '--cs-muted': colors.muted, '--cs-base': colors.base,
    '--cs-accent': colors.accent, '--cs-selected-ink': colors.selectedInk,
    '--cs-surface': colors.surface, '--cs-surface-solid': colors.solid,
    '--cs-scrim': colors.scrim, '--cs-scrim-blend': 'normal', '--cs-fallback': colors.fallback,
    '--cs-design-success': scheme === 'light' ? '#17553f' : '#bdfbe4',
    '--cs-design-warning': scheme === 'light' ? '#694411' : '#ffe8b8',
    '--cs-design-danger': scheme === 'light' ? '#8d2032' : '#ffe0e2',
    '--cs-font-body': sans, '--font-title': type.font || sans,
    '--cs-title-size': type.title, '--cs-title-weight': type.weight,
    '--cs-title-tracking': type.tracking, '--cs-stat-size': type.stat,
    '--cs-control-radius': type.radius, '--cs-radius': type.radius,
    '--cs-space-normal': type.gap, '--cs-padding': '12px',
  }),
})
export const DESIGNS = Object.freeze({
  'default': recipe('默认', '通用布局，保留组件的自然组织。', 'frosted-glass', 'light', {
    ink:'#252c35',muted:'#505966',base:'#f3f5f8',accent:'#3d526d',selectedInk:'#fff',surface:'#ffffffd9',solid:'#eef1f5',scrim:'linear-gradient(135deg,#f4f6f9dd,#e9eef4dd)',fallback:'linear-gradient(145deg,#f9fafc,#e3e9f1)',
  },{title:'22px',weight:700,tracking:'-.02em',stat:'30px',radius:'14px',gap:'8px'}),
  'atmospheric': recipe('氛围仪表盘', '天气/状态：大数字或图形作焦点，辅助指标分组。', 'tinted-glass', 'dark', {
    ink:'#f4f7ff', muted:'#d0daee', base:'#0b1326', accent:'#c7defc', selectedInk:'#142541',
    surface:'#18284699', solid:'#1d2e4a', scrim:'linear-gradient(135deg,#0b1326cf,#182846b8)',
    fallback:'radial-gradient(at 90% 0%,#70487b,transparent 65%),linear-gradient(145deg,#264775,#0b1326)',
  }, {title:'22px',weight:650,tracking:'-.025em',stat:'32px',radius:'16px',gap:'8px'}),
  'friendly': recipe('轻盈生活工具', '亲子/出行/清单：图片候选与轻盈色块，操作紧凑。', 'frosted-glass', 'light', {
    ink:'#202b39', muted:'#45546a', base:'#f5f7ff', accent:'#855300', selectedInk:'#ffffff',
    surface:'#ffffffb8', solid:'#eef3ff', scrim:'linear-gradient(135deg,#f9f9fff0,#e7eefedb)',
    fallback:'radial-gradient(at 100% 0%,#ffdfb0,transparent 60%),linear-gradient(145deg,#f9f9ff,#e7eefe)',
  }, {title:'21px',weight:750,tracking:'-.015em',stat:'28px',radius:'16px',gap:'10px'}),
  'cinematic': recipe('电影舞台', '电影/演出/探索：主视觉、醒目标题、少量高亮操作。', 'smoked-glass', 'dark', {
    ink:'#fff6df', muted:'#e3d9bd', base:'#121318', accent:'#ffe16d', selectedInk:'#302600',
    surface:'#252632b3', solid:'#242631', scrim:'linear-gradient(150deg,#121318bf,#121318eb)',
    fallback:'radial-gradient(at 80% 10%,#235367,transparent 60%),linear-gradient(155deg,#32304b,#121318)',
  }, {title:'24px',weight:750,tracking:'-.035em',stat:'30px',radius:'8px',gap:'8px'}),
  'editorial': recipe('编辑式图解', '解释/知识：图文层级、编号与重点，避免连续正文。', 'frosted-glass', 'light', {
    ink:'#252a2d', muted:'#525954', base:'#f6f3ec', accent:'#9a3b2c', selectedInk:'#ffffff',
    surface:'#fffcf6c2', solid:'#f1ede4', scrim:'linear-gradient(140deg,#f6f3eced,#f6f3ecde)',
    fallback:'linear-gradient(140deg,#faf7f0,#e7dfcf)',
  }, {font:'Georgia, "Noto Serif SC", "Songti SC", SimSun, serif',title:'23px',weight:700,tracking:'-.015em',stat:'28px',radius:'9px',gap:'9px'}),
  'pearl': recipe('月距力', '探索/模拟：珠光主视觉、共享深色实验面。', 'liquid-glass', 'dark', {
    ink:'#eef9f5', muted:'#bfd3d9', base:'#07151e', accent:'#b8f5df', selectedInk:'#102c31',
    surface:'#1d3943b3', solid:'#17303c', scrim:'linear-gradient(145deg,#07151e88,#07151edb)',
    fallback:'radial-gradient(at 90% 10%,#32556a,transparent 65%),linear-gradient(145deg,#102b37,#07151e)',
  }, {font:'Georgia, "Noto Serif SC", serif',title:'24px',weight:500,tracking:'-.025em',stat:'32px',radius:'18px',gap:'9px'}, 'pearl'),
  'atlas': recipe('动态学术', '知识/关系：象牙纸面、紫色图形舞台。', 'frosted-glass', 'light', {
    ink:'#27252f', muted:'#56515f', base:'#f2efe5', accent:'#7056a1', selectedInk:'#ffffff',
    surface:'#f8f5e9cc', solid:'#f2efe5', scrim:'linear-gradient(145deg,#f2efe5bb,#f2efe5ee)',
    fallback:'linear-gradient(140deg,#faf7ef,#e8e3d7)',
  }, {font:'Georgia, "Noto Serif SC", serif',title:'24px',weight:500,tracking:'-.035em',stat:'30px',radius:'10px',gap:'9px'}, 'particles'),
  'parchment': recipe('羊皮纸叙事', '阅读/历史/推理：蚀刻插画、朱红章节与视角切换。', 'frosted-glass', 'light', {
    ink:'#3b3027',muted:'#74634f',base:'#e9ddbd',accent:'#9c372c',selectedInk:'#fff7e4',surface:'#f2e6c9bb',solid:'#e8d9b9',scrim:'linear-gradient(140deg,#ede1cbbb,#dfcbaabb)',fallback:'linear-gradient(130deg,#f2e7ce,#d7c49e)',
  },{font:'Georgia, "Songti SC", serif',title:'25px',weight:500,tracking:'-.025em',stat:'32px',radius:'3px',gap:'8px'}),
  'business': recipe('专业商务', '比较/报告：藏蓝数字、青色共用刻度、清楚的数据口径。', 'frosted-glass', 'light', {
    ink:'#193546',muted:'#536d7c',base:'#f5f8f8',accent:'#247577',selectedInk:'#fff',surface:'#eaf0f1bb',solid:'#e9eff1',scrim:'linear-gradient(140deg,#f8fafbcc,#eaf0f1cc)',fallback:'linear-gradient(140deg,#fff,#edf2f4)',
  },{font:'Georgia, "Songti SC", serif',title:'25px',weight:500,tracking:'-.035em',stat:'34px',radius:'4px',gap:'8px'}),
  'academy': recipe('辉石学院', '探索/反思/选择：尖拱、星轨、三牌揭示与选中解读。', 'smoked-glass', 'dark', {
    ink:'#e1eafa',muted:'#adbed5',base:'#091127',accent:'#d1bc89',selectedInk:'#15233b',surface:'#1b3051bb',solid:'#162840',scrim:'radial-gradient(at 50% 30%,#1d355588,#091127cc)',fallback:'radial-gradient(at 50% 30%,#274668,#091127)',
  },{font:'Georgia, "Songti SC", serif',title:'23px',weight:500,tracking:'.04em',stat:'32px',radius:'5px',gap:'8px'}),
  'rebel': recipe('persona', '选择/活动：红黑拼贴、醒目选择与切纸过渡。', 'smoked-glass', 'dark', {
    ink:'#fff7e8', muted:'#e5cfca', base:'#181519', accent:'#e8ff80', selectedInk:'#18200d',
    surface:'#211a22cc', solid:'#251b23', scrim:'linear-gradient(145deg,#15111766,#151117e0)',
    fallback:'radial-gradient(at 95% 0%,#f02e4d,transparent 75%),linear-gradient(160deg,#9d1630,#171318)',
  }, {title:'26px',weight:900,tracking:'-.04em',stat:'32px',radius:'5px',gap:'9px'}, 'cutpaper'),
})
export const DESIGN_IDS = Object.freeze(Object.keys(DESIGNS))
export const getDesign = id => Object.hasOwn(DESIGNS, id) ? DESIGNS[id] : null
export const designReference = () => `design选default=默认、pearl=月距力（珠光探索）、atlas=动态学术（纸面计算）、rebel=persona（切纸选择）、parchment=羊皮纸（章节插画）、business=商务（同尺度比较）、academy=辉石（选择揭示）。先title和短caption，再用原有组件表达主体与操作；宿主负责布局、比例、材质和动画，不写装饰代码。没有真实关系或数值不要编造图表；旧design仍兼容。`+compositionReference()
