// Curated, pinned upstream metadata. Run after install-opencli, never at runtime.
import {readFile,writeFile} from 'node:fs/promises'
import {OPENCLI_LEGACY} from '../shared/cardspec/opencli-legacy.mjs'
const root=new URL('../',import.meta.url)
const manifest=JSON.parse(await readFile(new URL('.tools/opencli/1.8.6/node_modules/@jackwener/opencli/cli-manifest.json',root),'utf8'))
const selection={wttr:['current','forecast'],'12306':['stations','trains','price','train'],douban:['search','subject','movie-hot','photos'],weread:['shelf','highlights','notes','search'],jd:['search','item','reviews','cart','add-cart'],spotify:['search','status','play','pause','next','prev','volume','queue'],yollomi:['remove-bg','restore','upscale','background'],ctrip:['search','hotel-search','hotel','flight','attraction'],dianping:['search','shop'],bilibili:['search','subtitle','summary'],mubu:['search','doc'],xiaohongshu:['search','note','drafts']}
const groups={wttr:'weather','12306':'travel',ctrip:'travel',douban:'movies',weread:'reading',jd:'shopping',spotify:'music',yollomi:'images',dianping:'dining',bilibili:'learning',mubu:'notes',xiaohongshu:'social'}
// Curated consumer capabilities; exclude logins, arbitrary code, file writes,
// message publication, purchases and destructive operations.
const expansion={
 douban:['top250','book-hot','marks','reviews'],
 weread:['book','book-search','ranking','notebooks','ai-outline'],
 bilibili:['hot','ranking','video','comments','user-videos','following','history','feed','feed-detail','dynamic'],
 xiaohongshu:['feed','comments','user','saved','liked','notifications','creator-profile','creator-stats','creator-notes','creator-note-detail','creator-notes-summary'],
 zhihu:['hot','search','question','answer-detail','answer-comments','user','user-answers','user-articles','collections','collection','recommend'],
 weibo:['hot','search','post','comments','user','user-posts','feed','favorites'],
 youtube:['search','video','channel','playlist','comments','transcript','subscriptions','watch-later'],
 mubu:['docs','recent','notes'],flomo:['memos'],jd:['detail'],ctrip:['hotel-suggest'],smzdm:['search'],
 spotify:['repeat','shuffle'],
 'apple-podcasts':['search','top','episodes'],xiaoyuzhou:['episode','podcast','podcast-episodes'],
 wikipedia:['search','summary','page','trending','random'],wikidata:['search','entity'],dictionary:['search','examples','synonyms'],
 'rest-countries':['country','region'],tvmaze:['search','show'],steam:['search','app','top-sellers'],
 dongchedi:['search','series','models','specs','score','koubei'],autohome:['brand','score'],guazi:['browse','car'],
 google:['news','suggest','trends','search'],'duckduckgo':['suggest'],bbc:['news','topic'],toutiao:['hot'],'36kr':['news'],
 hackernews:['top','best','new','ask','show','read','search'],devto:['top','latest','read','tag'],lobsters:['hot','newest','read'],
 v2ex:['hot','latest','topic','replies','nodes','node'],
 archive:['search','item'],chess:['games','stats'],lichess:['top','user'],
 eastmoney:['quote','rank','kline','sectors','index-board','etf','announcement','kuaixun'],sinafinance:['news','stock']
}
for(const [site,names] of Object.entries(expansion))selection[site]=[...new Set([...(selection[site]||[]),...names])]
Object.assign(groups,{zhihu:'learning',weibo:'social',youtube:'learning',flomo:'notes',smzdm:'shopping','apple-podcasts':'podcasts',xiaoyuzhou:'podcasts',wikipedia:'knowledge',wikidata:'knowledge',dictionary:'language','rest-countries':'travel',tvmaze:'movies',steam:'games',dongchedi:'cars',autohome:'cars',guazi:'cars',google:'search',duckduckgo:'search',bbc:'news',toutiao:'news','36kr':'news',hackernews:'news',devto:'news',lobsters:'news',v2ex:'news',archive:'knowledge',chess:'games',lichess:'games',eastmoney:'finance',sinafinance:'finance'})
const camel=s=>s.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())
const definitions=[]
for(const [site,names] of Object.entries(selection))for(const name of names){
 const entry=manifest.find(t=>t.site===site&&t.name===name)
 if(!entry){const old=OPENCLI_LEGACY.find(t=>t.site===site&&t.command===name);if(old){definitions.push(old);continue}throw new Error(`Missing pinned command ${site}/${name}`)}
 const properties={},required=[],mapping={},defaults={},idTypes={}
 for(const arg of entry.args){
  if(['output','no-download','dry-run','images'].includes(arg.name)){if(arg.name==='no-download')defaults[arg.name]=true;else if(arg.name==='images')defaults.images=8;continue}
  const key=camel(arg.name),integer=['int','integer'].includes(arg.type)||arg.name==='limit'
  properties[key]={type:integer?'integer':arg.type==='number'?'number':['boolean','bool'].includes(arg.type)?'boolean':'string',description:arg.help}
  if(integer){const bounds={limit:[1,site==='dianping'?15:20],level:[0,100],days:[1,3],num:[1,10],page:[1,20],offset:[0,200],depth:[1,4],paragraphs:[0,20],'fragment-size':[20,500],'book-rank':[1,20]};const [minimum,maximum]=bounds[arg.name]||[0,2147483647];Object.assign(properties[key],{minimum,maximum})}
  else if(properties[key].type==='string')Object.assign(properties[key],{maxLength:['image','note-id','bvid'].includes(arg.name)?2000:300,...(arg.required?{minLength:1}:{})})
  if(arg.choices?.length)properties[key].enum=arg.choices
  if(/(^id$|[-_]id$|^uid$)/.test(arg.name)&&['string','integer'].includes(properties[key].type)){
   idTypes[key]=properties[key].type;properties[key].type=['string','integer'];properties[key].minLength=1;properties[key].maxLength=128
  }
  if(arg.required)required.push(key)
  mapping[key]=arg.name
  if(arg.default!=null)defaults[arg.name]=integer?Math.max(properties[key].minimum,Math.min(Number(arg.default),properties[key].maximum)):arg.default
 }
 if(site==='mubu'&&name==='doc')defaults.output='text'
 if(site==='weread'&&['book-search','ai-outline'].includes(name))defaults.raw=true
 if(site==='12306'&&name==='trains'){
  properties.limit.maximum=100
  Object.assign(properties,{departureAfter:{type:'string',description:'Departure at or after HH:MM, default 00:00; afternoon uses 12:00',maxLength:5,minLength:5},departureBefore:{type:'string',description:'Departure before HH:MM, default 24:00; afternoon uses 18:00',maxLength:5,minLength:5},exactStations:{type:'boolean',description:'Exact requested stations, default true; false explicitly includes nearby city stations'}})
  for(const key of ['departureAfter','departureBefore','exactStations'])mapping[key]=key
 }
 if(!groups[site])throw Error(`Missing semantic group: ${site}`)
 if(!/^[\w-]+\/[\w-]+\.js$/.test(entry.sourceFile))throw Error(`Unexpected adapter module ${entry.sourceFile}`)
 const note=site==='12306'?(name==='trains'?' Host filters exact stations and departureAfter/departureBefore BEFORE limit. Use these arguments for time ranges instead of filtering a limited list. available/bookable are booking flags, NOT ticket counts; display second_seat/first_seat/etc. Use rowKey for selection, code is not unique.':name==='train'||name==='price'?' Use trainNo=row.train_no, from=row.from_station, to=row.to_station from the selected trains result. Do not reuse the original station filters.':''):''
 definitions.push({id:`opencli.${site}.${name}`,provider:'opencli',group:groups[site],site,command:name,module:entry.sourceFile,description:entry.description+note,browser:entry.browser,strategy:entry.strategy,auth:site==='spotify'?'oauth':entry.browser?'browser-session':'none',readOnly:entry.access==='read',refreshable:entry.access==='read',timeoutMs:site==='yollomi'?120000:30000,inputSchema:{type:'object',required,properties},columns:site==='12306'&&name==='trains'?[...entry.columns,'departure_date','bookable']:entry.columns||[],...(site==='12306'&&name==='trains'?{identityFields:['train_no','from_station','to_station','departure_date'],nullableEmptyFields:['business_seat','first_seat','second_seat','soft_sleeper','hard_sleeper','hard_seat','no_seat'],fieldTypes:{available:'boolean',bookable:'boolean'},filterInputs:{start_time:['departureAfter','departureBefore']},fieldSemantics:{available:'boolean booking flag, not seat availability',bookable:'boolean booking flag',second_seat:'seat availability: 有/无/count/empty (unknown)'}}:{}),mapping,defaults,idTypes})
}
await writeFile(new URL('shared/cardspec/opencli-contract.mjs',root),`// Generated from @jackwener/opencli 1.8.6; edit selection in scripts/sync-opencli-contract.mjs.\nexport const OPENCLI_DEFINITIONS = ${JSON.stringify(definitions,null,2)}\n`)
console.log(`Wrote ${definitions.length} curated tool contracts`)
