import {generationModelOptions} from '../../shared/cardspec/generation-settings.mjs'

// Server-owned phases, never model/user supplied. Mechanical test authoring
// should not spend its entire output window on deep reasoning.
export function generationCallOptions(settings, options={}) {
 const profile=generationModelOptions(settings.modelProfile)
 // Total work is uncapped; individual requests still fit the provider window.
 if(settings.extendedGeneration===true&&options.buildPhase==='plan')return {...options,...profile,extendedGeneration:true,maxTokens:6144,maxReasoningCharacters:20000,reasoningEffort:'low',thinking:{type:'disabled'}}
 if(settings.extendedGeneration===true&&['unit','implementation','test'].includes(options.buildPhase))return {...options,...profile,extendedGeneration:true,maxTokens:Math.max(options.maxTokens||0,32768),maxReasoningCharacters:undefined,reasoningEffort:'low',thinking:{type:'disabled'}}
 if(settings.extendedGeneration===true)return {...options,...profile,extendedGeneration:true,maxTokens:Math.max(options.maxTokens||0,32768),maxReasoningCharacters:undefined,...(!['deepseek-flash','qwen-flash'].includes(settings.modelProfile)?{reasoningEffort:'high',thinking:{type:'enabled'}}:{})}
 if(settings.buildMode==='deep'&&['plan','unit','implementation','test'].includes(options.buildPhase)) {
  const phase=options.buildPhase
  const limits={plan:[6144,20000],unit:[8192,18000],test:[8192,28000],implementation:[16384,48000]}[phase]
  return {...options,...profile,maxTokens:limits[0],maxReasoningCharacters:limits[1],
   reasoningEffort:'low',thinking:{type:'disabled'}}
 }
 return {...options,...(settings.modelProfile==='deep'&&settings.buildMode!=='deep'?{maxTokens:Math.max(options.maxTokens||0,32768)}:{}),...profile}
}
