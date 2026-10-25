// Semantic navigation ownership. No business names, labels or CSS selectors.
export function navigationKind(node) {
  if (node.type === 'region' && node.props.overflow?.value === 'paginate') return 'page'
  return ({ carousel:'page', calendar:'month' })[node.type]
}
const stateKey = ast => ast?.type === 'get' && ast.object?.type === 'ref' && ast.object.name === 'state' ? ast.key?.value : null
function stepsPosition(ast, key) {
  if (!ast || typeof ast !== 'object') return false
  if (ast.type === 'binary' && ['+','-'].includes(ast.op) && stateKey(ast.left) === key) return true
  if (ast.type === 'call' && ast.name === 'addMonths' && stateKey(ast.args?.[0]) === key) return true
  return Object.values(ast).some(v => Array.isArray(v) ? v.some(x=>stepsPosition(x,key)) : v && typeof v==='object' && stepsPosition(v,key))
}
export function navigationDiagnostics(spec, { final = true } = {}) {
  const nodes=[], issues=[]
  function visit(list, loop=false) { for(const node of list) { nodes.push({node,loop}); visit(node.children || [],loop || node.type==='each') } }
  visit(spec.children)
  const owners=new Map(nodes.filter(({node})=>navigationKind(node)).map(({node})=>[node.id,node]))
  const controllers=nodes.filter(({node})=>node.type==='navigation')
  const add=(code,message,node,severity='error')=>issues.push({severity,code,message,nodeId:node.id})
  for(const {node,loop} of nodes) {
    if(node.props?.navigation && !navigationKind(node)) add('navigation_owner','navigation is only valid on a paging region, carousel or calendar',node)
    if(node.props?.navigation && node.props.navigation.type!=='literal') add('navigation_contract','navigation must be a literal auto or external',node)
    if(loop && node.props?.navigation?.value==='external') add('navigation_scope','external navigation owners must be outside each; use built-in navigation inside repeated items',node)
    if(node.type==='navigation') {
      const target=node.props.target?.value, owner=owners.get(target)
      if(loop) add('navigation_scope','external navigation must be outside each',node)
      if(!target) add('navigation_target','navigation requires a literal target component id',node)
      else if(!owner && final) add('navigation_target',`navigation target ${target} is not a navigation owner`,node)
      else if(owner && owner.props.navigation?.value!=='external') add('navigation_duplicate',`${target} must explicitly set navigation="external" before adding a navigation component`,node)
      if(controllers.filter(c=>c.node.props.target?.value===target).length>1) add('navigation_duplicate',`only one navigation component may control ${target}`,node)
    }
    if(node.props?.navigation?.value==='external' && final && !controllers.some(c=>c.node.props.target?.value===node.id)) add('navigation_missing',`${node.id} requires one navigation component targeting it`,node)
    if(navigationKind(node)==='page' && final) {
      const items=(node.children||[]).filter(c=>c.type!=='run' && c.props?.visible?.value!==false)
      const soleOwner=n=>navigationKind(n) || (['stack','box','region','if'].includes(n.type) && n.children?.filter(c=>c.type!=='run').length===1 && soleOwner(n.children.find(c=>c.type!=='run')))
      if(items.length===1 && soleOwner(items[0])) add('navigation_nested',`${node.id} pages a single component which already owns navigation; remove the outer paging behavior`,node)
    }
    if(['button','chip','pressable'].includes(node.type) && node.props.visible?.value!==false) {
      const steps=spec.actions[node.props.onPress?.value] || []
      for(const owner of owners.values()) {
        const key=stateKey(owner.props.index || owner.props.month)
        if(key && steps.some(s=>s.target===key && (s.type==='increment' || stepsPosition(s.value,key)))) add('navigation_duplicate',`${node.id} manually steps ${owner.id}'s position; use the owner's built-in controls or navigation="external" with one navigation target`,node)
      }
    }
  }
  return issues
}
