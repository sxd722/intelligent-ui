import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readDatasetText,longTextFields} from '../server/cardspec/dataset-text.mjs'
const record={id:'D1',tool:'article',value:{items:[{extract:'intro '.repeat(200)+'documented evidence '+'tail '.repeat(400),url:'https://example.com/source'}]}}
test('long text can be located and paged without fetching or inventing content',()=>{
 const a=readDatasetText(record,{field:'extract',find:'documented evidence',textLimit:300})
 assert.ok(a.matched);assert.ok(a.text.includes('documented evidence'));assert.equal(a.text,record.value.items[0].extract.slice(a.start,a.end));assert.ok(a.nextOffset)
 const b=readDatasetText(record,{field:'extract',textOffset:a.nextOffset,textLimit:300});assert.equal(b.start,a.end)
 assert.deepEqual(longTextFields(record.value.items),[{row:0,field:'extract',chars:record.value.items[0].extract.length}])
})
test('reader rejects inherited fields, invalid rows and unbounded requests',()=>{
 for(const options of [{field:'constructor'},{field:'extract',offset:4},{field:'extract',textLimit:10000},{field:'extract',textOffset:-1}])assert.throws(()=>readDatasetText(record,options))
})
