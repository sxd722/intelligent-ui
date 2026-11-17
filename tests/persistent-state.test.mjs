import test from 'node:test'
import assert from 'node:assert/strict'
import {fitPersistentState} from '../shared/cardspec/persistent-state.mjs'
import {applyWebStateUpdate} from '../shared/cardspec/web-state.mjs'
import {logicJson} from '../shared/cardspec/logic-contract.mjs'

test('long game keeps current board and newest undo entries across 150 transactions',()=>{
 let state={board:Array(361).fill(0),moves:0,history:[]},removed=0
 for(let i=1;i<=150;i++){
  state=applyWebStateUpdate(state,s=>({...s,board:s.board.map((v,j)=>j===(i-1)%361?i:v),moves:i,history:[...s.history,{board:s.board.slice(),moves:s.moves}]}),r=>{removed+=r.totalRemoved})
  assert.equal(state.moves,i);assert.equal(state.board[(i-1)%361],i);assert.doesNotThrow(()=>logicJson(state,{record:true}))
 }
 assert(removed>0);assert.equal(state.history.at(-1).moves,149)
 assert(state.history.every((h,i,a)=>!i||a[i-1].moves===h.moves-1))
 const restored=JSON.parse(logicJson(state,{record:true}))
 const undone=applyWebStateUpdate(restored,s=>({...s,...s.history.at(-1),history:s.history.slice(0,-1)}))
 assert.equal(undone.moves,149);assert.equal(undone.board[149],0)
})
test('FIFO is minimal, immutable, covers byte capacity and non-game undo queues',()=>{
 const original={text:'current',undoStack:Array.from({length:8},(_,i)=>({id:i,text:'x'.repeat(10000)}))}
 const fit=fitPersistentState(original)
 assert.equal(original.undoStack.length,8);assert.equal(fit.totalRemoved,2)
 assert.deepEqual(fit.state.undoStack.map(x=>x.id),[2,3,4,5,6,7]);assert.equal(fit.state.text,'current')
 assert.throws(()=>logicJson({...fit.state,undoStack:original.undoStack.slice(1)},{record:true}))
})
test('never deletes domain records or commits invalid transactions',()=>{
 const previous={n:1,history:[]}
 for(const data of [{board:Array(5000).fill(0),history:[1]}, {records:Array(5000).fill(0)}, {n:Infinity},JSON.parse('{"__proto__":{}}')]){
  assert.throws(()=>applyWebStateUpdate(previous,data));assert.deepEqual(previous,{n:1,history:[]})
 }
 assert.throws(()=>fitPersistentState({history:[{n:Infinity},...Array(5000).fill(1)]}))
})
test('multiple history queues fit, reset remains possible, normal state identity remains stable',()=>{
 const s={n:1,history:Array(2500).fill(1),actionHistory:Array(2500).fill(2)}
 const fit=fitPersistentState(s);assert(fit.totalRemoved>0);assert.equal(fit.state.n,1)
 assert.doesNotThrow(()=>logicJson(fit.state,{record:true}))
 assert.deepEqual(applyWebStateUpdate(fit.state,{n:0,history:[]}),{n:0,history:[]})
 const small={n:1};assert.equal(applyWebStateUpdate(small,x=>x),small)
})
