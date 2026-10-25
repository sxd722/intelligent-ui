import {expressionPath as path,visitExpression as visit,expressionReads,referencePaths,businessIdField} from './dataflow.mjs'
import {collectionRowBindings} from './tool-collection-state.mjs'

// Conservative checks for observable dataflow mistakes, not domain rules.
export function interactionDiagnostics(spec){
  const errors=[],seen=new Set(),rowStates=new Set(),rowArgs=new Set(),tableActions=new Set(),snapshots=new Map(),toolSnapshots=new Map(),entityActions=new Map(),entityStates=new Set(),entitySources=new Map()
  const error=(code,message)=>{if(!seen.has(message)){seen.add(message);errors.push({severity:'error',code,message})}}
  const nodes=[];function walk(list,toolRows=[]){for(const n of list||[]){nodes.push(n);const fromTool=n.type==='each'?collectionRowBindings(spec,n.props.items):toolRows;if(fromTool.length)for(const [key,value] of Object.entries(n.props||{}))if(key.startsWith('on'))entityActions.set(value.value,[...new Set([...(entityActions.get(value.value)||[]),...fromTool])]);walk(n.children,fromTool)}}walk(spec.children)
  // A visual projection is the event.item/event.row payload, not the original
  // tool record. Check identity reads even when live data is initially empty.
  function projectedKeys(ast,seen=new Set()){
    const p=path(ast)
    if(['derived','data'].includes(p?.[0])&&p.length===2&&!seen.has(p.join('.')))return projectedKeys(spec[p[0]][p[1]],new Set([...seen,p.join('.')]))
    if(ast?.type==='chain')return projectedKeys(ast.value,seen)
    if(ast?.type==='call'&&['filter','method:slice'].includes(ast.name))return projectedKeys(ast.args[0],seen)
    const row=ast?.type==='call'&&ast.name==='map'?ast.args[1]:null
    if(row?.type==='object'&&row.entries.every(([k])=>typeof k==='string'))return new Set(row.entries.map(([k])=>k))
    return null
  }
  for(const n of nodes){
    const source={map:'items',collection:'items',experience:'items',table:'rows'}[n.type],keys=source&&projectedKeys(n.props[source])
    if(!keys)continue
    const payload=n.type==='table'?'row':'item',handler=n.props.onSelect?.value
    for(const step of spec.actions[handler]||[]){
      const identities=[step.key,...(step.value?.type==='object'?step.value.entries.filter(([k])=>['id','rowKey'].includes(k)).map(([,v])=>v):[])]
      for(const ast of identities){
        const p=path(ast)
        if(p?.length===3&&p[0]==='event'&&p[1]===payload&&!keys.has(p[2]))error('event_projection_identity',`${n.id}.${handler}: ${p.join('.')} is absent from the projected ${n.type} record (fields: ${[...keys].join(', ')}). Use the actual projected identity, or retain original fields with object spread. event.${payload} is the rendered record, not the original tool row.`)
      }
    }
  }
  function rowIdentity(ast,action,visited=new Set()){
    const p=path(ast)
    if(p){
      if(p.at(-1)==='rowKey')return true
      if(['state','next'].includes(p[0]))return rowStates.has(p.slice(1).join('.'))
      if(p[0]==='args')return rowArgs.has(`${action}:${p[1]}`)
      if(p[0]==='event'&&p[1]==='id')return tableActions.has(action)
      if(p[0]==='derived'&&p.length===2&&!visited.has(p[1]))return rowIdentity(spec.derived[p[1]],action,new Set([...visited,p[1]]))
      return false
    }
    if(ast?.type==='call'&&['string','js:String'].includes(ast.name))return rowIdentity(ast.args[0],action,visited)
    if(ast?.type==='conditional')return rowIdentity(ast.yes,action,visited)||rowIdentity(ast.no,action,visited)
    if(ast?.type==='binary'&&ast.op==='??')return rowIdentity(ast.left,action,visited)||rowIdentity(ast.right,action,visited)
    return false
  }
  for(const n of nodes){
    if(n.type==='table'){
      let rows=n.props.rows;const p=path(rows);if(p?.[0]==='derived'&&p.length===2)rows=spec.derived[p[1]]
      if(rows?.type==='call'&&rows.name==='map'){
        const projection=rows.args[1],p=path(projection)
        if(projection?.type==='literal'&&typeof projection.value!=='object'||p?.[0]===(rows.params?.[0]||'item')&&['id','rowKey'].includes(p.at(-1)))error('collection_shape',`${n.id}: table.rows must contain objects, not an array of IDs. Pass full rows or map each row to an object.`)
        if(projection?.type==='object'&&projection.entries.some(([k,v])=>k==='id'&&rowIdentity(v)))tableActions.add(n.props.onSelect?.value)
      }
    }
  }
  // Fixed point handles state aliases and UI args across multiple actions.
  for(let round=0;round<=Object.keys(spec.state).length;round++){
    for(const n of nodes)for(const [event,handler] of Object.entries(n.props||{}))if(event.startsWith('on'))
      for(const [name,value] of n.props.args?.entries||[])if(rowIdentity(value))rowArgs.add(`${handler.value}:${name}`)
    for(const [action,steps] of Object.entries(spec.actions))for(const s of steps)if(s.type==='set'&&!s.key){
      if(rowIdentity(s.value,action))rowStates.add(s.target)
      for(const [field,value] of s.value?.entries||[])if(rowIdentity(value,action))rowStates.add(`${s.target}.${field}`)
      if(spec.state[s.target]?.type==='record'&&entityActions.has(action)&&(expressionReads(spec,s.value,'args').length||s.value?.type==='ref'&&s.value.name==='args')){entityStates.add(s.target);entitySources.set(s.target,[...new Set([...(entitySources.get(s.target)||[]),...entityActions.get(action)])])}
    }
  }
  // Keep dependency declarations compact for the model: preserve provenance
  // automatically when an explicitly selected full row is copied into state.
  for(const [id,b] of Object.entries(spec.bindings||{}))if(b.tool==='glm.generate'){
    const inputs=[b.input,...Object.values(spec.actions).flat().filter(s=>s.type==='invoke'&&s.binding===id&&s.input).map(s=>s.input)]
    b.requires=[...new Set([...(b.requires||[]),...inputs.flatMap(input=>expressionReads(spec,input,'state').flatMap(name=>entitySources.get(name)||[]))])]
  }
  function checkInput(ast,tool,action){if(tool==='glm.generate'){
    const context=ast?.entries?.find(([k])=>k==='context')?.[1]
    for(const name of expressionReads(spec,context,'state').filter(id=>entityStates.has(id))){
      let identified=false
      for(const p of referencePaths(context))if(p[0]==='state'&&p[1]===name&&(p.length===2||businessIdField(p.at(-1))&&!rowStates.has(p.slice(1).join('.'))))identified=true
      const wrongId=[...rowStates].some(k=>k.startsWith(name+'.')&&businessIdField(k.split('.').at(-1)))
      if(!identified||wrongId)error('tool_context_identity',`glm.generate context loses the business identity of selected state.${name}. Save the full clicked row (args={entry}; set value={args}) and pass context:{entity:state.${name}}. Keep rowKey separate from the original business id; titles/ratings alone cannot identify a detail source.`)
    }
    return
  }
    for(const [field,value] of ast?.entries||[])if(businessIdField(field)&&rowIdentity(value,action))error('tool_business_identity',`${tool}.${field} receives a rowKey. Preserve the selected full row; use its business ${field}, not the table/each selection key.`)
  }
  for(const b of Object.values(spec.bindings||{}))checkInput(b.input,b.tool)
  for(const [action,steps] of Object.entries(spec.actions)){
    const written=new Set()
    for(const s of steps){
      if(s.type==='invoke'){
        const b=spec.bindings[s.binding],input=s.input||b?.input;checkInput(input,b?.tool,action)
        if(spec.actionMode==='snapshot')for(const name of expressionReads(spec,input,'state'))if(written.has(name))errors.push({severity:'warning',code:'action_stale_input',message:`${action}: invoke ${s.binding} deliberately captures pre-action state.${name}. To submit the new value use invoke input with next.${name}; state remains the entry snapshot.`})
      }else written.add(s.target)
    }
    const cleared=new Set(steps.filter(s=>s.type==='set'&&!s.key&&(s.value?.type==='object'&&!s.value.entries.length||s.value?.type==='array'&&!s.value.items?.length)).map(s=>s.target))
    for(const s of steps)if(s.type==='set'&&!s.key&&!cleared.has(s.target)&&['array','record'].includes(spec.state[s.target]?.type)){
      const dependencies=expressionReads(spec,s.value,'state').filter(k=>cleared.has(k))
      if(dependencies.length)snapshots.set(s.target,new Set([...(snapshots.get(s.target)||[]),...dependencies]))
      // Copying a tool answer freezes the answer, not the inputs used to label
      // it. Later draft edits must not silently relabel an already saved row.
      for(const binding of expressionReads(spec,s.value,'bindings')){
        const b=spec.bindings[binding];if(!b)continue
        const inputs=[b.input,...Object.values(spec.actions).flat().filter(x=>x.type==='invoke'&&x.binding===binding&&x.input).map(x=>x.input)]
        const deps=inputs.flatMap(input=>expressionReads(spec,input,'state')).filter(k=>k!==s.target)
        if(deps.length)toolSnapshots.set(s.target,new Set([...(toolSnapshots.get(s.target)||[]),...deps]))
      }
    }
  }
  for(const n of nodes)if(n.type==='each')for(const name of expressionReads(spec,n.props.items,'state')){
    const live=toolSnapshots.get(name)
    if(live){
      const reads=new Set(expressionReads(spec,n.children,'state').filter(k=>live.has(k)))
      if(reads.size){const message=`${n.id}: saved state.${name} rows still read mutable input ${[...reads].map(k=>'state.'+k).join(', ')}. Save the labels/display fields with the result or save its input context, then render the saved copy; editing the draft should not relabel saved results.`
        if(!seen.has(message)){seen.add(message);errors.push({severity:'warning',code:'saved_tool_live_read',message})}
      }
    }
    const reset=snapshots.get(name);if(!reset)continue
    visit(n.children,ast=>{for(const key of expressionReads(spec,ast,'state'))if(reset.has(key))error('snapshot_live_read',`${n.id}: saved state.${name} is displayed using resettable state.${key}. Materialize quantities/labels/prices in the saved rows with map(...,{...}) before reset, and render only saved row fields.`)})
  }
  return errors
}
