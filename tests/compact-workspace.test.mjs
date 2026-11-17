import test from 'node:test'
import assert from 'node:assert/strict'
import {workspaceColumns} from '../src/cardspec/compact-workspace.mjs'
test('short repeated actions use available width without demanding many columns',()=>{
 assert.equal(workspaceColumns('actions',248,5,35),2)
 assert.equal(workspaceColumns('actions',360,5,35),2)
 assert.equal(workspaceColumns('actions',248,5,130),1)
 assert.equal(workspaceColumns('actions',360,5,130),2)
})
test('inventory preserves minimum readable width and expands only with room',()=>{
 assert.equal(workspaceColumns('cards',248,5,20),3)
 assert.equal(workspaceColumns('cards',360,5,20),4)
 assert.equal(workspaceColumns('cards',248,5,55),2)
 assert.equal(workspaceColumns('cards',Infinity,5,20),1)
 assert.equal(workspaceColumns('actions',500,2,20),1)
})
