// Only exact, non-behavioral equivalences. Never guess actions, IDs, values,
// collection keys, units, expression syntax, or tool arguments.
export const COMPONENT_ALIASES=Object.freeze({bold:'strong',italic:'emphasis'})
export function ignoredPresentationAttribute(key,ast){
 return ['class','className'].includes(key)&&ast?.type==='literal'&&typeof ast.value==='string'
}
