import test from 'node:test'
import assert from 'node:assert/strict'
import {validateJson,validateSchema,validateToolInput,JSON_SCHEMA_KEYWORDS,toolReference} from '../shared/cardspec/tools.mjs'

const schema={type:'object',required:['slots'],properties:{slots:{type:'array',minItems:4,maxItems:4,items:{type:'string'}}}}
test('generated JSON can require an exact number of records, enforced on results',()=>{
  validateToolInput('glm.generate',{prompt:'Generate four records',schema})
  assert.throws(()=>validateJson({slots:[]},schema),/\$\.slots: too few items/)
  assert.throws(()=>validateJson({slots:['a','b','c']},schema),/too few items/)
  assert.deepEqual(validateJson({slots:['a','b','c','d']},schema),{slots:['a','b','c','d']})
  assert.throws(()=>validateJson({slots:['a','b','c','d','e']},schema),/too many items/)
  assert.throws(()=>validateJson({slots:['a','b','c',0]},schema),/slots\[3\]: expected string/)
})
test('array bounds are meaningful integers and cannot contradict each other',()=>{
  for(const value of [-1,1.5,'4',null,Infinity])for(const key of ['minItems','maxItems']){
    assert.throws(()=>validateSchema({type:'array',items:{type:'string'},[key]:value}),/expected non-negative integer/)
  }
  assert.throws(()=>validateSchema({type:'array',items:{type:'string'},minItems:5,maxItems:4}),/minItems exceeds maxItems/)
  const empty={type:'array',items:{type:'string'},minItems:0,maxItems:0};validateSchema(empty);validateJson([],empty)
})
test('unknown validation keywords remain errors with their precise schema path',()=>{
  assert.throws(()=>validateSchema({type:'object',properties:{rows:{type:'array',items:{type:'string'},uniqueItems:true}}}),/\$\.properties\.rows\.uniqueItems: unsupported JSON schema keyword/)
})
test('model schema disclosure is derived from the validator keyword contract',()=>{
  assert.ok(toolReference(true,['glm.generate']).includes(JSON_SCHEMA_KEYWORDS.join('/')))
})
