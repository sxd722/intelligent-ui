const visualTypes=new Set(['image','map','chart','mindmap','flowchart','mermaid','heatmap','sandbox','task-board'])
export function hasContentVisual(spec){return (function walk(nodes){return (nodes||[]).some(n=>visualTypes.has(n.type)||walk(n.children))})(spec?.children)}
export function protectContentVisual(required,spec){return required&&!hasContentVisual(spec)?[{severity:'error',code:'repair_visual_intent_lost',message:'修复删除了原稿的内容主视觉。保留图片（加载失败时仍保留位置与重试能力）或用等价图形/宿主构图替换；请移动筛选、折叠详情或修正测试导航，不要用纯列表替代。'}]:[]}
