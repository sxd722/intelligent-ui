// A completed first page never completes its siblings. On restored streams no
// request is running; retained drafts remain readable, but cannot invoke tools.
export function deckItemState(item,{streaming=false,retrying=false}={}){
 const ready=item?.status==='ready'
 const pending=['pending','generating'].includes(item?.status)
 return {ready,busy:!ready&&(retrying||pending&&streaming),incomplete:!ready&&!retrying&&(!pending||!streaming)}
}
