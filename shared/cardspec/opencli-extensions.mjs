// Reviewed local adapters, kept separate from the generated upstream manifest.
// Same OpenCLI execution limits, public fetch guard and schema validation apply.
const base={provider:'opencli',group:'finance',site:'yahoo-finance',browser:false,strategy:'public',auth:'none',readOnly:true,refreshable:true,timeoutMs:30000};
const symbol={type:'string',minLength:1,maxLength:20,description:'Stock ticker, e.g. AAPL; never a URL'};
export const OPENCLI_EXTENSIONS=[
 {...base,id:'opencli.yahoo-finance.chart',command:'chart',description:'真实股票历史收盘价序列（时间戳+价格），1d=最近交易日5分钟，5d=五交易日60分钟，1mo=近月日线；不能用当前报价的开高低收伪造走势。',inputSchema:{type:'object',required:['symbol'],properties:{symbol,range:{type:'string',enum:['1d','5d','1mo']}}},mapping:{symbol:'symbol',range:'range'},defaults:{range:'1d'},columns:['symbol','date','timestamp','close','open','high','low','volume','currency','exchangeTimezone','range','interval','marketTime','sourceUrl']},
 {...base,id:'opencli.yahoo-finance.news',command:'news',description:'按股票代码与可选公司名读取相关新闻（标题或摘要须明确提及实体），含原始标题、源摘要、来源、日期和原文链接；不提供重要度分数。',inputSchema:{type:'object',required:['symbol'],properties:{symbol,company:{type:'string',minLength:1,maxLength:80,description:'Optional company name for explicit headline/summary matching, e.g. Nvidia'},limit:{type:'integer',minimum:1,maximum:12}}},mapping:{symbol:'symbol',company:'company',limit:'limit'},defaults:{limit:8},columns:['id','symbol','title','summary','source','feedSource','date','url']}
];
