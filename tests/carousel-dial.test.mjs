import test from 'node:test'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {CAROUSEL_FIXTURES} from '../shared/cardspec/carousel-fixtures.mjs'
import {MOBILE_FIXTURES} from '../shared/cardspec/mobile-fixtures.mjs'
import {INTERACTION_FIXTURES} from '../shared/cardspec/interaction-fixtures.mjs'

test('arc carousel uses unchanged contract across seven design families and old forms/external navigation',()=>{
 for(const [name,source] of Object.entries({...CAROUSEL_FIXTURES,form:MOBILE_FIXTURES.carousel,external:INTERACTION_FIXTURES.externalCarousel})){
  const result=compileCard(source,{final:true,cardId:name})
  assert.deepEqual(result.diagnostics.filter(d=>d.severity==='error'),[],name)
 }
})
