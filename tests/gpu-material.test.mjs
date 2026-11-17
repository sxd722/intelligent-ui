import test from 'node:test'
import assert from 'node:assert/strict'
import {prepareShader} from '@vgpu/wgsl/prepare'
import {validateMaterial,materialShader,PEARL_SHADER,WAVE_SHADER} from '../shared/cardspec/gpu-material.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {GPU_MATERIAL_FIXTURES} from '../shared/cardspec/gpu-material-fixtures.mjs'
for(const [name,source]of Object.entries({pearl:PEARL_SHADER,wave:WAVE_SHADER}))test(name+' prepares a reflected shader without executing GPU',()=>{
 const prepared=prepareShader(materialShader(source));assert.equal(prepared.version,2)
})
for(const source of ['loop {}','for(var i=0;i<4;i++){}','return textureLoad(x);','fn x() {}','@compute fn x() {}','return foo();'])test('reject forbidden shader '+source,()=>assert.throws(()=>validateMaterial({source})))
test('bound inputs and height',()=>{
 for(const p of [{params:[NaN,0,0,0]},{params:[1]},{height:900}])assert.throws(()=>validateMaterial({source:PEARL_SHADER,...p}))
})
for(const [name,source]of Object.entries(GPU_MATERIAL_FIXTURES))test(name+' compiles as native CardSpec',()=>{
 const result=compileCard(source);assert.deepEqual(result.diagnostics.filter(x=>x.severity==='error'),[])
})
