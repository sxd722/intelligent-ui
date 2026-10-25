const row={type:'object',additionalProperties:true},str={type:'string',maxLength:2000}
export const HOST_RESULT_SCHEMA={type:'object',required:['items','source','fetchedAt','truncated'],properties:{items:{type:'array',maxItems:600,items:row},source:str,fetchedAt:str,truncated:{type:'boolean'},steps:{type:'array',maxItems:6,items:row},analysis:row}}
export const HOST_TOOLS=[
 {id:'workflow.run',provider:'host',group:'workflow',site:'host',command:'collect',description:'组合1–6个只读来源；宿主串行浏览器、保留失败状态与来源，不能递归或写操作',readOnly:true,refreshable:true,timeoutMs:180000,
  inputSchema:{type:'object',required:['steps'],properties:{steps:{type:'array',maxItems:6,items:{type:'object',required:['id','tool','input'],properties:{id:{type:'string',minLength:1,maxLength:40},tool:{type:'string',minLength:1,maxLength:120},input:row,after:{type:'array',maxItems:6,items:{type:'string',maxLength:40}}}}}}},outputSchema:HOST_RESULT_SCHEMA},
 {id:'dataset.analyze',provider:'host',group:'workflow',site:'host',command:'analyze',description:'用户请求后对最多40条原记录作有引文的分类，返回原记录及analysisLabel/analysisQuote；宿主计数，不能当全网统计',readOnly:true,refreshable:false,timeoutMs:60000,
  inputSchema:{type:'object',required:['items','instruction'],properties:{items:{type:'array',maxItems:40,items:row},instruction:{type:'string',minLength:1,maxLength:600}}},outputSchema:HOST_RESULT_SCHEMA}
]
