// A terminal protocol envelope, not an executable host tool. The build loop
// still validates versions, module scope, syntax and transaction boundaries.
export const BUILD_OPERATION_TOOL={type:'function',function:{name:'submit_build_operation',description:'提交当前模块的一个文件操作，或当前验收阶段的测试操作。宿主校验后才应用。',parameters:{type:'object',required:['op'],properties:{
 op:{type:'string',enum:['write','patch','chunk','read','describe','test','implementation_issue','blocked']},
 files:{type:'array',maxItems:1,items:{type:'object',required:['name','content'],properties:{name:{type:'string'},version:{type:'string'},content:{type:'string'}}}},
 name:{type:'string',description:'patch/chunk 的目标文件名，必须填写；module 仅用于 implementation_issue'},version:{type:'string'},offset:{type:'integer',minimum:0},content:{type:'string'},done:{type:'boolean'},
 edits:{type:'array',maxItems:8,items:{type:'object',required:['old','new'],properties:{old:{type:'string'},new:{type:'string'}}}},
 names:{type:'array',maxItems:6,items:{type:'string'}},claims:{type:'array',maxItems:12,items:{type:'object'}},steps:{type:'array',maxItems:16,items:{type:'object'}},
 reason:{type:'string'},module:{type:'string'},stepIndex:{type:'integer'}
}}}}
