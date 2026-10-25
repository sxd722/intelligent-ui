// A deliberately narrow recovery: insert a missing container closer only when
// the model explicitly closes an ancestor. Never invent values, keys, commas,
// quotes or EOF completion; an incomplete stream remains an error.
export function closePlanningContainers(source) {
  let at=0
  const edits=[]
  const fail=()=>{throw new SyntaxError(`Unrecoverable planning JSON at ${at}`)}
  const space=()=>{while(/\s/.test(source[at]||'')&&at<source.length)at++}
  function string() {
    const start=at++
    while(at<source.length) {
      if(source[at]==='\\'){at+=2;continue}
      if(source[at++]==='"'){JSON.parse(source.slice(start,at));return}
    }
    fail()
  }
  function value(ancestors) {
    space()
    const c=source[at]
    if(c==='"'){string();return}
    if(c==='{'||c==='['){container(c,ancestors);return}
    const match=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(source.slice(at))
    if(!match)fail()
    at+=match[0].length
  }
  function container(open,ancestors) {
    if(ancestors.length>=32)fail()
    const close=open==='{'?'}':']';at++;space()
    if(source[at]===close){at++;return}
    while(at<source.length) {
      if(open==='{') {if(source[at]!=='"')fail();string();space();if(source[at++]!==':')fail()}
      value([...ancestors,close]);space()
      if(source[at]===close){at++;return}
      if(ancestors.includes(source[at])&&[']','}'].includes(source[at])) {
        if(edits.length>=8)fail()
        edits.push({offset:at,insert:close});return
      }
      if(source[at++]!==',')fail()
      space() // A trailing comma is not a missing closer.
    }
    fail()
  }
  value([]);space();if(at!==source.length||!edits.length)fail()
  let cursor=0,normalized=''
  for(const edit of edits){normalized+=source.slice(cursor,edit.offset)+edit.insert;cursor=edit.offset}
  normalized+=source.slice(cursor)
  JSON.parse(normalized)
  return {source:normalized,edits}
}
