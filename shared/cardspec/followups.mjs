// Separate presentation from generation intent. Legacy sessions store strings;
// their full prompt remains intact while the button stays compact.
export function followupEntries(plan){
 return (plan?.followups||[]).slice(0,2).flatMap(value=>{
  const prompt=typeof value==='string'?value:value?.prompt
  if(typeof prompt!=='string'||!prompt.trim())return []
  const label=typeof value?.label==='string'&&value.label.trim()?value.label.trim():prompt.trim().split(/[。；\n]/)[0]
  const characters=Array.from(label)
  return [{prompt,label:characters.length>24?characters.slice(0,23).join('')+'…':label}]
 })
}
