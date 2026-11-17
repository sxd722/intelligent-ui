// Read only a bounded slice of an already fetched, host-owned field.
export function readDatasetText(record,{offset=0,field,textOffset=0,textLimit=1600,find}={}) {
 if(!Number.isInteger(offset)||offset<0||!Number.isInteger(textOffset)||textOffset<0||!Number.isInteger(textLimit)||textLimit<100||textLimit>2400)throw Error('invalid text range')
 const row=record.value?.items?.[offset]
 if(!row||!Object.hasOwn(row,field)||typeof row[field]!=='string')throw Error('text field not found in dataset row')
 const text=row[field];let start=textOffset,matched
 if(find!==undefined){if(typeof find!=='string'||!find.trim()||find.length>120)throw Error('invalid text query');const index=text.toLowerCase().indexOf(find.toLowerCase(),textOffset);matched=index>=0;if(matched)start=Math.max(textOffset,index-160)}
 const end=Math.min(text.length,start+textLimit)
 return {dataset:record.id,tool:record.tool,row:offset,field,totalChars:text.length,start,end,text:text.slice(start,end),nextOffset:end<text.length?end:null,...(matched!==undefined?{matched}:{}),source:row.url||record.value?.source}
}
export function longTextFields(items,offset=0){return items.flatMap((row,i)=>Object.entries(row).filter(([,v])=>typeof v==='string'&&v.length>500).map(([field,v])=>({row:offset+i,field,chars:v.length}))).slice(0,12)}
