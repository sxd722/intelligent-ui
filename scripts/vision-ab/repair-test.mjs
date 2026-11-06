import assert from 'node:assert/strict';import {parseJavaScriptExpression,evaluateJavaScriptExpression} from '../../shared/cardspec/javascript-expression.mjs';import {resolveClickStep} from '../../server/cardspec/build-feedback.mjs';
const ast=parseJavaScriptExpression('[0,false,null,"",1,"yes"].filter(Boolean)');
assert.deepEqual(evaluateJavaScriptExpression(ast,{},{remaining:10000}),[1,'yes']);
assert.throws(()=>parseJavaScriptExpression('[1].filter(eval)'));
const controls=[{name:'实际按钮',role:'button',disabled:false}];
assert.equal(resolveClickStep({op:'click',name:'点击按钮',value:'实际按钮'},controls).name,'实际按钮');
assert.equal(resolveClickStep({op:'click',name:'点击按钮',value:'实际按钮'},[...controls,...controls]).name,'点击按钮');
assert.equal(resolveClickStep({op:'fill',name:'输入框',value:'实际按钮'},controls).name,'输入框');
console.log('PASS Boolean filtering, unsafe callback rejection, exact unique observed click normalization');

assert.equal(resolveClickStep({op:'click',name:'南\n南极圈' },[{name:'南 南极圈',role:'button',handle:'h'}]).handle,'h');
