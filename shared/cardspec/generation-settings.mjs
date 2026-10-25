// Host-owned allowlist. Cards and follow-up requests retain their own settings;
// old sessions continue using the legacy expression dialect/configured model.
export const MODEL_PROFILES=Object.freeze({
 default:{label:'默认 GLM-5.3 Flash'},
 deep:{label:'GLM-5.3 深度思考',model:'glm-5.3'},
 'deepseek-flash':{label:'DeepSeek V4.1 Flash',model:'volcengine/deepseek-v4.1-flash'},
 'qwen-flash':{label:'Qwen 3.8 Flash',model:'qwen3.8-flash'},
})
export const normalizeModelProfile=value=>Object.hasOwn(MODEL_PROFILES,value)?value:'default'
export const generationSettings=(view={})=>({...(['default','pearl','atlas','rebel','parchment','business','academy'].includes(view.designPreference)?{designPreference:view.designPreference}:{}),...(view.debugGeneration===true?{debugGeneration:true}:{}),expressionDialect:view.expressionDialect==='js-v1'?'js-v1':'legacy',modelProfile:normalizeModelProfile(view.modelProfile)})
export const generationModelOptions=profile=>profile==='deep'?{modelOverride:'glm-5.3',reasoningEffort:'high',thinking:{type:'enabled'}}:['deepseek-flash','qwen-flash'].includes(profile)?{modelOverride:MODEL_PROFILES[profile].model,reasoningEffort:undefined,thinking:{type:'disabled'}}:{}
