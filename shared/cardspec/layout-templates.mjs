// One stable design token selects a host composition. No model-authored layout code.
export const LAYOUT_TEMPLATES = Object.freeze({
 parchment:Object.freeze({label:'羊皮纸叙事',signature:'PALIMPSEST',mark:'I',version:1}),
 business:Object.freeze({label:'专业商务',signature:'BRIEF',mark:'+',version:1}),
 academy:Object.freeze({label:'辉石学院',signature:'ACADEMY',mark:'✦',version:1}),
 default: Object.freeze({label:'默认',signature:'',mark:'',version:1}),
 pearl: Object.freeze({label:'月距力',signature:'SELENE',mark:'µ',effect:'pearl',version:1}),
 atlas: Object.freeze({label:'动态学术',signature:'ATLAS',mark:'a.',version:1}),
 rebel: Object.freeze({label:'persona',signature:'PERSONA',mark:'↗',ornament:'cutpaper',version:1}),
})
export const TEMPLATE_IDS = Object.freeze(Object.keys(LAYOUT_TEMPLATES))
const heading = new Set(['title','caption','badge'])
const graphics = new Set(['chart','heatmap','flowchart','mindmap','mermaid','map','image','carousel','collection','experience','sandbox'])
export function templateRole(node) {
 if(graphics.has(node.type))return 'visual'
 if(node.type==='region'&&node.props?.role?.value==='actions')return 'actions'
 if(['slider','segmented','chips','select','radio-group'].includes(node.type))return 'control'
 if(['button','row'].includes(node.type))return 'actions'
 return 'content'
}
export function projectTemplate(nodes=[],design) {
 const template=LAYOUT_TEMPLATES[design]
 if(!template||design==='default')return {id:'default',reason:'default',header:[],body:nodes}
 // Only a leading, unscoped editorial heading can be promoted. Never flatten
 // logic/each/if/region: that could alter their scope, navigation or meaning.
 let end=0
 while(end<nodes.length&&heading.has(nodes[end].type))end++
 const header=nodes.slice(0,end)
 if(!header.some(n=>n.type==='title')||end===nodes.length)return {id:'default',reason:'no-leading-heading',header:[],body:nodes}
 return {id:design,reason:'matched',header,body:nodes.slice(end)}
}
