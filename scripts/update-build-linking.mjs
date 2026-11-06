import fs from 'node:fs'
const path='server/cardspec/deep-build.mjs'
let s=fs.readFileSync(path,'utf8')
s=s.replaceAll("buildInterface(workspace.read('main.cardspec').content)",'buildInterface(workspace.interfaceSource())')
s=s.replace('main.cardspec声明全部共享state/action并通过','main.cardspec声明共享state和唯一页面导航，并通过').replace('片段只写组件，不写card/state/action。','片段写UI及其专属action/derive，声明置于片段顶层，宿主链接到card；共享ID全局唯一，不重复声明。')
s=s.replace('只写本片段UI，不写state/action/binding/card；引用actualInterface的状态，缺少的动作由main联调补齐。','只写本片段UI及专属动作，不写card；引用actualInterface已有共享状态/动作，不重复声明。')
s=s.replace('片段仅组件节点，不写card/state/action。','片段包含组件及顶层专属action/derive，由宿主链接；不要重复actualInterface已有声明。')
s=s.replace('分页组件可用自己的内置导航。','主导航由main统一提供，详情/对比片段不要重复绘制相同跳转；有明确返回语义时保留一个返回入口。分页组件可用自己的内置导航。真实图片用<image assetRef={row.assetRef} mediaRole="thumbnail" alt={row.title}/>；query仅为示意图片检索词，不接受图片URL，不同时写两种来源。')
fs.writeFileSync(path,s)
const test='tests/data-needs-units.test.mjs'
s=fs.readFileSync(test,'utf8').replace("assert.throws(()=>w.write([{name:'bad.cardspec',content:'<fragment><text>Wrong wrapper</text></fragment>'}],{checkSyntax:true}),/unknown component fragment/)","w.write([{name:'wrapped.cardspec',content:'<fragment><text>Transparent wrapper</text></fragment>'}],{checkSyntax:true})").replace("assert.throws(()=>w.write([{name:'bad.cardspec',content:'<button onPress=\"go\">Go</button><action id=\"go\"/>'}],{checkSyntax:true}),/UI fragment/)","w.write([{name:'actions.cardspec',content:'<button onPress=\"go\">Go</button><action id=\"go\"/>'}],{checkSyntax:true})")
fs.writeFileSync(test,s)
