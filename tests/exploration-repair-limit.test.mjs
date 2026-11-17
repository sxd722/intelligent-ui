import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRepairLimit} from '../scripts/exploration/repair-limit.mjs'
test('non-source tool text and rollback do not consume source repair allowance',()=>{
 const limit=createRepairLimit(2),initial='<card id="a"/>',repair='<card id="b"/>',repair2='<card id="c"/>'
 assert.equal(limit.observe(initial).kind,'new')
 assert.equal(limit.observe(repair).kind,'new')
 assert.equal(limit.observe('<DSML tool="card_retest">...</DSML>').kind,'not-card-source')
 assert.equal(limit.observe(repair).kind,'duplicate')
 assert.equal(limit.repairs,1);assert.equal(limit.canRequest(),true)
 assert.equal(limit.observe(repair2).kind,'new');assert.equal(limit.canRequest(),false)
 assert.equal(limit.observe('<card id="d"/>').kind,'limit')
 assert.equal(limit.repairs,2)
})
test('recorded V1 sequence contains two repairs, one tool serialization and one repeat',()=>{
 const base='experiments/round1-20261117/runs/screen-01-recording-kit-V1-r2/source-versions/'
 const limit=createRepairLimit(2)
 const kinds=['01','02','03','04','05'].map(n=>limit.observe(readFileSync(base+n+'.cardspec','utf8')).kind)
 assert.deepEqual(kinds,['new','new','not-card-source','duplicate','new']);assert.equal(limit.repairs,2);assert.equal(limit.canRequest(),false)
})
