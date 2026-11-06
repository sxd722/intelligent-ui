// The pile represents forward navigation, never previously visited cards.
export function forwardPile(cards=[],index=0){
 return cards.slice(Math.max(0,index+1),Math.max(0,index+1)+3).map((card,i)=>({...card,depth:i+1}))
}
