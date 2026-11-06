// A planning request must never become the prefix of an unrelated conversation.
// The authoritative goal is supplied by this generation's host, not by history.
export function planningTaskInput(goal,messages=[]){
 if(typeof goal==='string'&&goal.trim())return {goal:goal.slice(0,6000)};
 for(let i=messages.length-1;i>=0;i--){const m=messages[i];if(m.role!=='user')continue;const text=typeof m.content==='string'?m.content:Array.isArray(m.content)?m.content.filter(p=>p.type==='text').map(p=>p.text).join('\n'):'';if(!text.trim())continue;
  try{const parsed=JSON.parse(text);if(typeof parsed.request==='string'&&parsed.request.trim())return {goal:parsed.request.slice(0,6000)}}catch{}
  return {goal:text.slice(0,6000)};
 }
 return {goal:''};
}
