import { evaluate } from '../../shared/cardspec/expression.mjs'
import { createStore, makeScope, executeAction } from '../../shared/cardspec/store.mjs'
import {executeLogic} from '../../shared/cardspec/logic-engine.mjs'
import {validateLogicView} from '../../shared/cardspec/logic-view.mjs'
import {probeLogicInteractions} from './logic-probes.mjs'
import {logicLifecycleIssue} from './logic-diagnostics.mjs'
import {compileSandbox} from './sandbox.mjs'
import {diagnosticContext} from '../../shared/cardspec/diagnostic-context.mjs'

// Run only on completed documents, not every streaming character.
export async function validateRichContent(result) {
  if(!result.spec) return
  const {spec}=result
  let activeNode
  const issue=(code,message,id)=>diagnosticContext(result.source||'',{severity:'error',code,message,nodeId:id,offset:result.locations?.[id],locationKind:'component'})
    // Inspect literal lifecycle contracts even behind an initially closed tab.
    // Do not evaluate hidden input expressions or execute hidden modules.
    function lifecycle(nodes){for(const n of nodes||[]){
      if(n.type==='logic'&&n.props.reactive?.value===true&&n.props.input&&n.props.source?.type==='literal'){
        try{
          const issue=logicLifecycleIssue(n.props.source.value)
          if(issue){result.complete=false;result.diagnostics.push(diagnosticContext(result.source||'',{severity:'error',code:'logic_initialization',message:`logic ${n.id} initialization: ${issue}`,nodeId:n.id,offset:result.locations?.[n.id],locationKind:'component'}))}
        }catch{ /* Syntax errors are already reported by compileCard. */ }
      }
      lifecycle(n.children)
    }}lifecycle(spec.children)
  // Collect independent static problems together for the one repair. Invalid
  // documents never reach evaluation/QuickJS or tool effects.
  if(!result.complete)return
  const scope=makeScope(spec,createStore())
  try {
    // Compile every literal module before delivery, including initially hidden
    // regions. Missing source is an initial-generation repair, never a later call.
    spec.sandboxModules={}
    async function surfaces(nodes){for(const n of nodes||[]){
      if(n.type==='sandbox'){
        activeNode=n.id
        if(n.props.source?.type!=='literal'||!n.props.source.value?.trim())throw Error(`sandbox ${n.id}: include complete JSX in literal source; no deferred generation`)
        const options={probe:true,input:n.props.input?evaluate(n.props.input,scope):{},initial:n.props.initial?evaluate(n.props.initial,scope):{},capabilities:Object.keys(n.props.actions?evaluate(n.props.actions,scope):{})}
        spec.sandboxModules[n.id]=await compileSandbox(n.props.source.value,options)
      }
      await surfaces(n.children)
    }}
    await surfaces(spec.children)
    async function visit(nodes,local) {
      for(const n of nodes) {
        activeNode=n.id
        if(n.type==='logic'){
          let state=evaluate(n.props.initial,local)
          // Final generation harness only: a bounded, isolated init computes no
          // host effects. compileCard and streaming previews remain execution-free.
          {
            const {getQuickJS}=await import('quickjs-emscripten')
            const engine=await getQuickJS()
            if(n.props.reactive&&evaluate(n.props.reactive,local))try{state=executeLogic(engine,{source:evaluate(n.props.source,local),state,event:{type:'init'},input:n.props.input?evaluate(n.props.input,local):{}})}catch(e){throw Error(`logic ${n.id} init: ${e.message}`)}
            validateLogicView(n.children,{...local,local:state},{strictLocalValues:true})
            const probe=probeLogicInteractions(engine,n,local,state)
            ;(result.logicProbes??=[]).push({id:n.id,...probe})
          }
          await visit(n.children,{...local,local:state});continue
        }
        if(n.type==='each') {
          const items=evaluate(n.props.items,local)
          for(const [index,item] of items.entries()) await visit(n.children,{...local,item,index,[n.props.as?.value||'item']:item})
          continue
        }
        if(n.type==='if'&&!evaluate(n.props.test,local)) continue
        if(n.props?.visible&&!evaluate(n.props.visible,local)) continue
        if(n.type==='mermaid') {
          const {renderDiagram}=await import('../../shared/cardspec/mermaid-render.mjs')
          const rendered=renderDiagram(evaluate(n.props.source,local))
          if(n.props.onSelect&&!Object.hasOwn(local,'local')) for(const item of rendered.nodes) {
            const event={id:item.id,label:item.label,value:item.id},args=n.props.args?evaluate(n.props.args,{...local,event}):{}
            executeAction(spec,createInitializedStore(spec),n.props.onSelect.value,{...local,event,args})
          }
        }
        if(n.type==='math') {
          const {default:katex}=await import('katex')
          katex.renderToString(evaluate(n.props.value,local),{throwOnError:true,trust:false,maxExpand:100,maxSize:10,strict:'error'})
        }
        await visit(n.children||[],local)
      }
    }
    await visit(spec.children,scope)
  } catch(e) { result.complete=false;result.diagnostics.push(issue('rich_content',e.message,activeNode)) }
}
function createInitializedStore(spec) { const s=createStore();makeScope(spec,s);return s }
