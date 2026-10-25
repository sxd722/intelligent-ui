// Semantic choices only. Rendering, contrast and motion stay host-owned.
export const VISUAL_STYLES = Object.freeze({
  'photo-glass': Object.freeze({ label: '摄影渐变玻璃', description: '照片主导，渐变蒙版与克制玻璃，适合故事、旅行和内容浏览。' }),
  'tinted-glass': Object.freeze({ label: '染色氛围玻璃', description: '背景染色与柔和高光，适合音乐、幻想和情绪表达。' }),
  'liquid-glass': Object.freeze({ label: '液态折射玻璃', description: '清晰照片上叠局部玻璃与折射边光，适合轻盈的交互面板。' }),
  'frosted-glass': Object.freeze({ label: '柔和磨砂玻璃', description: '柔和磨砂与稳定阅读面，适合工具、状态和信息密集卡片。' }),
  'smoked-glass': Object.freeze({ label: '烟黑舞台玻璃', description: '深色材质、层叠阴影与轮廓光，适合角色、道具和成就。' }),
})
export const VISUAL_STYLE_IDS = Object.freeze(Object.keys(VISUAL_STYLES))
export const BACKGROUND_POSITIONS = Object.freeze(['center', 'top', 'bottom', 'left', 'right'])
export const getVisualStyle = (id) => Object.hasOwn(VISUAL_STYLES, id) ? VISUAL_STYLES[id] : null
export const validBackgroundQuery = (query) => typeof query === 'string' && query.trim().length > 0 && query.trim().length <= 100 && !/[\u0000-\u001f\u007f]/.test(query) && !/^\s*(?:https?:|data:|javascript:)/i.test(query)
export const visualStyleReference = () => Object.entries(VISUAL_STYLES).map(([id, style]) => `${id}：${style.description}`).join('\n')
