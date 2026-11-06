// Explicit disclosure semantics first; compatibility for old source-only regions.
// Never move a form, action, tool target, map or other interactive result.
const prose=new Set(['region','row','stack','box','list','list-item','each','if','text','caption','strong','emphasis','link','run'])
import {referencePaths} from './dataflow.mjs'
const safe=n=>prose.has(n.type)&&!Object.keys(n.props||{}).some(k=>/^on[A-Z]/.test(k))&&(n.children||[]).every(safe)
export function isSupportingContent(node){
 if(node.type!=='region'||!safe(node))return false
 // Live receipts and selection explanations belong to the interaction.
 if(referencePaths(node).some(p=>['bindings','state','next','derived'].includes(p[0])))return false
 if(node.props?.role?.value==='details')return true
 const label=node.props?.label?.value
 return typeof label==='string'&&/来源|参考资料|免责声明|sources?|references?/i.test(label)
}
