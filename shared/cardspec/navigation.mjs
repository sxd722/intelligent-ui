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
  function visit(list, loop=false,guards=[]) { for(const node of list) { nodes.push({node,loop,guards}); visit(node.children || [],loop || node.type==='each',node.type==='if'?[...guards,JSON.stringify(node.props.test)]:guards) } }
  visit(spec.children)
  // Detect duplicate view controls by state semantics, never by display labels.
  // Only unconditional top-level selectors can replace a pure view jump.
  const globalSelectors=[]
  function selectors(list,conditional=false){for(const n of list||[]){
    if(n.type==='segmented'&&!conditional&&stateKey(n.props.value))globalSelectors.push(n)
    selectors(n.children,conditional||['if','each','popover'].includes(n.type)||!!n.props?.visible)
  }}selectors(spec.children)
  const owners=new Map(nodes.filter(({node})=>navigationKind(node)).map(({node})=>[node.id,node]))
  const controllers=nodes.filter(({node})=>node.type==='navigation')
  const add=(code,message,node,severity='error')=>issues.push({severity,code,message,nodeId:node.id})
  const viewKeys=new Set(nodes.filter(({node})=>node.type==='if').flatMap(({node})=>[stateKey(node.props.test?.left),stateKey(node.props.test?.right),stateKey(node.props.test?.args?.[0]?.left),stateKey(node.props.test?.args?.[0]?.right)]).filter(Boolean))
  const jumps=[]
  for(const entry of nodes){
    const {node,loop,guards}=entry,steps=spec.actions[node.props?.onPress?.value]||[],step=steps[0]
    if(loop||!['button','chip','pressable'].includes(node.type)||node.props?.args||node.props?.visible||steps.length!==1||step.type!=='set'||step.when||step.value?.type!=='literal'||!viewKeys.has(step.target))continue
    const prior=jumps.find(p=>p.target===step.target&&p.value===step.value.value&&(p.guards.every(g=>guards.includes(g))||guards.every(g=>p.guards.includes(g))))
    if(prior)add('view_navigation_duplicate',`${node.id} and ${prior.id} are co-visible jumps to the same view. Keep one return/navigation control, retaining state.`,node,'warning')
    jumps.push({id:node.id,target:step.target,value:step.value.value,guards})
  }
  for(const {node,loop} of nodes) {
    if(node.props?.navigation && !navigationKind(node)) add('navigation_owner','navigation is only valid on a paging region, carousel or calendar',node)
    if(node.props?.navigation && node.props.navigation.type!=='literal') add('navigation_contract','navigation must be a literal auto or external',node)
    if(loop && node.props?.navigation?.value==='external') add('navigation_scope','external navigation owners must be outside each; use built-in navigation inside repeated items',node)
    if(node.type==='navigation') {
      const target=node.props.target?.value, owner=owners.get(target)
      if(loop) add('navigation_scope','external navigation must be outside each',node)
      if(!target) add('navigation_target','navigation requires a literal target component id',node)
      else if(!owner && final) add('navigation_target',`navigation target ${target} is not a paging owner. Use carousel/calendar/region overflow="paginate" with navigation="external"; for application views use segmented -> state.view -> if, not navigation`,node)
      else if(owner && owner.props.navigation?.value!=='external') add('navigation_duplicate',`${target} must explicitly set navigation="external" before adding a navigation component`,node)
      if(controllers.filter(c=>c.node.props.target?.value===target).length>1) add('navigation_duplicate',`only one navigation component may control ${target}`,node)
    }
    if(navigationKind(node) && node.props?.navigation?.value==='external' && final && !controllers.some(c=>c.node.props.target?.value===node.id)) add('navigation_missing',`${node.id} requires one navigation component targeting it`,node)
    if(navigationKind(node)==='page' && final) {
      const items=(node.children||[]).filter(c=>c.type!=='run' && c.props?.visible?.value!==false)
      const soleOwner=n=>navigationKind(n) || (['stack','box','region','if'].includes(n.type) && n.children?.filter(c=>c.type!=='run').length===1 && soleOwner(n.children.find(c=>c.type!=='run')))
      if(items.length===1 && soleOwner(items[0])) add('navigation_nested',`${node.id} pages a single component which already owns navigation; remove the outer paging behavior`,node)
    }
    if(['button','chip','pressable'].includes(node.type) && node.props.visible?.value!==false) {
      const steps=spec.actions[node.props.onPress?.value] || []
      const jump=steps.length===1&&steps[0].type==='set'&&!steps[0].when&&steps[0].value?.type==='literal'?steps[0]:null
      if(jump)for(const selector of globalSelectors){
        const options=selector.props.options,values=options?.type==='literal'&&Array.isArray(options.value)?options.value.map(o=>o.value):options?.type==='array'?options.items.map(o=>o.type==='object'?o.entries.find(([k])=>k==='value')?.[1]?.value:undefined):[]
        if(stateKey(selector.props.value)===jump.target&&values.includes(jump.value.value))add('view_navigation_redundant',`${node.id} repeats ${selector.id}'s view switch to ${jump.value.value}. Keep one view navigation owner; remove this duplicate or give it a distinct contextual action.`,node,'warning')
      }
      for(const owner of owners.values()) {
        const key=stateKey(owner.props.index || owner.props.month)
        if(key && steps.some(s=>s.target===key && (s.type==='increment' || stepsPosition(s.value,key)))) add('navigation_duplicate',`${node.id} manually steps ${owner.id}'s position; use the owner's built-in controls or navigation="external" with one navigation target`,node)
      }
    }
  }
  return issues
}
