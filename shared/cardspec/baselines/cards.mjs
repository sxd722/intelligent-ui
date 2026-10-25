import {SOURCES,SEEDS,FAMILY_SCHEMA} from './logic.mjs'
const q=JSON.stringify
const empty={items:[],source:'',fetchedAt:'',truncated:false}
const bindings={
 sentiment:{news:['opencli.google.news',{keyword:'尊界 刹车',limit:8}],weibo:['opencli.weibo.search',{keyword:'尊界 刹车',limit:8}],xhs:['opencli.xiaohongshu.search',{query:'尊界 刹车',limit:8}],videos:['opencli.bilibili.search',{query:'尊界 刹车',limit:8,type:'video'}],comments:['opencli.bilibili.comments',{bvid:'BV1xx411c7mD',limit:12}],analyze:['dataset.analyze',{items:[],instruction:'按原文分类'}]},
 family:{search:['opencli.ctrip.search',{query:'杭州 萧山 亲子',limit:12}],plan:['glm.generate',{prompt:'按选择规划'}]},
 movies:{search:['opencli.douban.search',{keyword:'科幻',type:'movie',limit:12}],hot:['opencli.douban.movie-hot',{limit:12}],detail:['opencli.douban.subject',{id:'1292722',type:'movie'}],videos:['opencli.bilibili.search',{query:'电影 官方 预告',type:'video',limit:6}]},
 trains:{search:['opencli.12306.trains',{from:'杭州东',to:'上海虹桥',date:'2026-10-23',limit:20}],refresh:['opencli.12306.trains',{from:'杭州东',to:'上海虹桥',date:'2026-10-23',limit:20}]},
 transformer:{}
};
const names={sentiment:'舆情观察',family:'周末亲子',movies:'今晚看什么',transformer:'计算显微镜',trains:'周末双城'}
const field=(name,label,type='text')=>`<input label="${label}" inputType="${type}" value={local.${name}} onChange="field" args={{name:"${name}"}}/>`
const tab=(values)=>`<segmented label="当前视图" value={local.tab} options={${q(values)}} onChange="tab"/>`
const busy='disabled={local.pending!=""}'
const button=(action,label,extra='')=>`<button onPress="${action}" ${extra}>${label}</button>`
const pager=`<row justify="between">${button('prev','上一组','disabled={local.page==0}')}<caption>{local.page+1} / {local.pages}</caption>${button('next','下一组','disabled={local.page+1>=local.pages}')}</row>`
const poster=x=>`<if test={${x}.assetRef!=null}><image assetRef={${x}.assetRef} alt={${x}.title} mediaRole="thumbnail"/></if>`
const status=`<if test={local.message!=""}><caption tone="muted">{local.message}</caption></if>`
const raw=()=>`<region overflow="details" label="原始资料（按需展开）"><code block={true} value={local.raw}/></region>`

const ui={
sentiment:`
${tab(['态度概览','时间走势','原文','新闻时间线','社交线索','取数'])}
<region role="content" overflow="scroll" label="议题与证据" resetKey={local.tab}>
<if test={local.tab=="取数"}>
 ${field('query','监控议题')}
 <row wrap>${button('news','搜索新闻',busy)}${button('weibo','搜索微博',busy)}${button('xhs','搜索小红书',busy)}${button('videos','搜索 B站',busy)}</row>
 <caption>微博不可用时可查小红书线索或 B站。笔记标题、视频标题不计态度；B站需进一步获取评论。</caption>
 <each items={local.coverage} itemKey={item.id}><caption>{item.label} · {item.value} 条 · {item.status}</caption></each>
</if>
<if test={local.total==0&&local.tab=="态度概览"}><text>先在“取数”搜索议题与反馈，再按原文分析态度。</text></if>
<if test={local.tab=="态度概览"}>
 <stat label="当前可用反馈样本" value={local.total}/>
 <chart label="对车辆的态度 · 点击查看原文" data={local.counts} onSelect="chart"/>
 ${button('analyze','分析样本态度','disabled={local.pending!=""||local.total==0}')}
 <caption>有引文的模型分类，不代表全网民意；新闻与视频线索不参与统计。</caption>
</if>
<if test={local.tab=="时间走势"}><chart kind="stacked" label="有明确日期的反馈样本" data={local.series} onSelect="chart"/><caption>{local.unknown} 条无可核实日期；显示最近六个有数据的日期。</caption></if>
<if test={local.tab=="原文"||local.tab=="新闻时间线"||local.tab=="社交线索"}>
 <if test={local.tab=="原文"}><select label="态度筛选" value={local.attitude} options={["全部","正向","负向","中性","不确定","无关","未分析"]} onChange="field" args={{name:"attitude"}}/>${button('all','清除日期筛选')}</if>
 <collection label="来源记录" items={local.rows} fields={local.tab=="新闻时间线"?["source","displayDate"]:["source","attitude"]} detailMode="external" onSelect="select"/>
 <if test={local.focus!=null}><strong>{local.focus.title}</strong><text clamp={3}>{local.focus.content??local.focus.summary??local.focus.snippet??""}</text><caption>{local.focus.quote??""}</caption>
 <if test={local.tab=="社交线索"&&local.focus.bvid!=null&&local.focus.bvid!=""}>${button('comments','获取这条视频的评论',busy)}</if>
 ${raw('local.focus')}</if>
</if>
${status}</region>`,
family:`
${tab(['地图选点','候选','两天计划','准备'])}
<region role="content" overflow="scroll" label="周末安排" resetKey={local.tab}>
<if test={local.tab=="地图选点"||local.tab=="候选"}>
 ${field('query','目的地关键词')}${button('search','找亲子地点',busy)}
 <if test={local.tab=="地图选点"}><map label="地点坐标示意" items={local.rows} selectedId={local.focus.rowKey??""} onSelect="focus"/></if>
 <if test={local.tab=="候选"}><collection label="候选地点" items={local.rows} fields={["displayType","cityName"]} selectedId={local.focus.rowKey??""} detailMode="external" onSelect="focus"/></if>
 <if test={local.focus!=null}>${poster('local.focus')}<strong>{local.focus.title}</strong>
 ${button('toggle','{count(local.selected,item.rowKey==local.focus.rowKey)>0?"取消选择":"加入周末"}')}<caption>已选 {len(local.selected)} / 4 · 刷新不会丢失选择</caption></if>
</if>
<if test={local.tab=="两天计划"}>
 <region overflow="details" label="选中地点与规划偏好">
 <each items={local.selected} itemKey={item.rowKey}><caption>{item.title}</caption></each>
 ${field('age','孩子年龄')}${field('preference','活动偏好')}
 <slider label="预算目标（非实际报价）" min={100} max={2000} step={100} value={local.budget} onChange="field" args={{name:"budget"}}/>
 </region>
 ${button('plan','按选中地点规划两天','disabled={local.pending!=""||len(local.selected)==0}')}
 <if test={local.plan!=null}><strong>{local.plan.headline}</strong><segmented label="哪一天" value={local.day} options={[{value:0,label:"周六"},{value:1,label:"周日"}]} onChange="day"/>
 <each items={local.schedule} itemKey={item.ref}><box surface="soft" space="loose"><badge>{item.period==0?"上午":"下午"}</badge><strong>{item.title}</strong><text>{item.activity}</text><caption>{item.reason}</caption></box></each>
 <caption>中午留给午休 · 开放、门票、交通及适龄性待核实</caption>
 <region overflow="details" label="注意事项"><each items={local.plan.cautions} itemKey={item}><caption>{item}</caption></each></region>
 </if>
</if>
<if test={local.tab=="准备"}><each items={["水和点心","换洗衣物","雨具 / 防晒","预约与开放时间已确认","回家路线已确认"]} itemKey={item}><checkbox label={item} checked={local.packed[item]??false} onChange="check" args={{key:item}}/></each></if>
${status}</region>`,
movies:`
${tab(['发现','详情','比较','去观看'])}
<region role="content" overflow="scroll" label="选一部电影" resetKey={local.tab}>
<if test={local.tab=="发现"}>
 ${field('query','电影关键词')}<row>${button('search','找电影',busy)}${button('hot','正在热映',busy)}</row>
 <segmented label="最低评分" value={local.rating} options={[{value:0,label:"不限"},{value:7,label:"7+"},{value:8,label:"8+"},{value:9,label:"9+"}]} onChange="field" args={{name:"rating"}}/>
 <collection label="影片候选" presentation="gallery" items={local.visible} fields={["rating"]} detailMode="external" onSelect="select"/>
 <caption>已获取结果中 {local.total} 部符合筛选；海报缺失不影响选择。</caption>
</if>
<if test={local.tab=="详情"}>
 <if test={local.detail!=null}>${poster('local.detail')}<title>{local.detail.title}</title>
 <row><badge>★ {local.detail.rating??"未知"}</badge><caption>{local.detail.genres??""} · {local.detail.duration??"片长未知"}</caption></row>
 <text clamp={4}>{local.detail.summary??local.detail.abstract??"可继续获取来源详情"}</text>
 <row wrap>${button('detail','获取完整资料',busy)}${button('compare','加入 / 移出比较')}${button('choose','今晚就看它')}</row>
 ${raw('local.detail')}</if>
 <if test={local.detail==null}><caption>先点击一张候选海报。</caption></if>
</if>
<if test={local.tab=="比较"}>
 <caption>保存的候选 {len(local.chosen)} / 3</caption>
 <each items={local.chosen} itemKey={item.rowKey}><box surface="soft" space="loose">${poster('item')}<strong>{item.title}</strong><badge>★ {item.rating??"未知"}</badge><row>${button('choose','选择这部','args={{item:item}}')}${button('remove','移除','args={{id:item.rowKey}}')}</row></box></each>
</if>
<if test={local.tab=="去观看"&&local.pick!=null}>
 ${poster('local.pick')}<title>{local.pick.title}</title><caption>TONIGHT'S PICK · 已保存完整选择</caption>
 ${button('videos','查 B站相关视频',busy)}
 <each items={local.pageRows} itemKey={item.rowKey}><pressable onPress="video" args={{url:item.url??""}}><strong>{item.title}</strong><caption>{item.author??""} · 点击后在底部打开来源</caption></pressable></each>${pager}
 <caption>视频可能是预告 / 解说，不保证正片或播放权。购票入口需自行选择城市场次。</caption>
</if>
${status}</region>`,
trains:`
${tab(['双程票夹','查找车次','行程管理'])}
<region role="content" overflow="scroll" label="出发与归来" resetKey={local.tab}>
<if test={local.tab=="双程票夹"}>
 <each items={[0,1]} as="leg" itemKey={leg}><box surface="soft" space="loose"><badge>{leg==0?"去程":"返程"}</badge>
 <if test={local.tickets[leg]!=null}><strong>{local.tickets[leg].code} · {local.tickets[leg].date}</strong><row justify="between"><stat label={local.tickets[leg].from} value={local.tickets[leg].start_time}/><stat label={local.tickets[leg].to} value={local.tickets[leg].arrive_time}/></row>
 <caption>{local.tickets[leg].seat=="second_seat"?"二等座":"一等座"} · {local.tickets[leg][local.tickets[leg].seat]??"余票未知"}</caption>
 <countdown target={local.release[leg]==""?"":local.release[leg]+"+08:00"} label="用户核实的起售时间" expiredLabel="已到设定时间，请在官方核实"/>
 ${button('manage','管理提醒与余票','args={{leg:leg}}')}</if>
 <if test={local.tickets[leg]==null}><caption>在“查找车次”中固定一班{leg==0?"去程":"返程"}。</caption></if>
 </box></each>
 <copy value={local.copy} label="复制双程行程"/>
</if>
<if test={local.tab=="查找车次"}>
 <segmented label="去返程" value={local.leg} options={[{value:0,label:"去程"},{value:1,label:"返程"}]} onChange="leg"/>
 <region overflow="details" label="查询条件">
 ${field('from','杭州车站')}${field('to','上海车站')}<input label="出发日期" inputType="date" value={local.dates[local.leg]} onChange="date"/>
 ${field('after','最早出发','time')}<select label="席别" value={local.seat} options={[{value:"second_seat",label:"二等座"},{value:"first_seat",label:"一等座"}]} onChange="field" args={{name:"seat"}}/></region>
 <caption>{local.leg==0?local.from:local.to} → {local.leg==0?local.to:local.from} · {local.dates[local.leg]}</caption>
 ${button('search','查询车次',busy)}
 <if test={local.loaded!=null}><caption>本批结果：{local.loaded.date} · {local.loaded.from} → {local.loaded.to}</caption></if>
 <collection label="车次候选" items={local.rows} fields={["start_time","arrive_time","second_seat"]} detailMode="external" onSelect="select"/>
 <if test={local.candidate!=null}><box surface="soft"><strong>固定 {local.candidate.code}？</strong><caption>{local.candidate.query.date} · {local.candidate.start_time}</caption>${button('pin','固定此车次')}</box></if>
</if>
<if test={local.tab=="行程管理"&&local.tickets[local.manage]!=null}>
 <title>{local.tickets[local.manage].code}</title>
 <input label="核实的起售时间（北京时间）" inputType="datetime-local" value={local.release[local.manage]} onChange="release" args={{leg:local.manage}}/>
 <caption>由用户在官方渠道核实，不用发车时间推算起售。</caption>
 ${button('refresh','刷新原车次余票',busy)}<caption>采集时间：{local.tickets[local.manage].fetchedAt}</caption>
 ${raw('local.tickets[local.manage]')}
</if>
${status}</region>`,
transformer:`
${tab(['数值流','注意力','FFN显微镜','输入设置'])}
<region role="content" overflow="scroll" label="一层 Transformer" resetKey={local.tab}>
<segmented label="观察 token" value={local.token} options={local.tokens} onChange="token"/>
<if test={local.tab=="数值流"}>
 <segmented label="计算步骤" value={local.step} options={[{value:0,label:"输入"},{value:1,label:"注意力"},{value:2,label:"残差①"},{value:3,label:"激活"},{value:4,label:"投影"},{value:5,label:"输出"}]} onChange="step"/>
 <caption>{local.note}</caption><chart label="当前阶段向量（含正负值）" data={local.vector}/><caption>最终输出：{local.output}</caption>
</if>
<if test={local.tab=="注意力"}><heatmap label="谁在关注谁 · 每行权重和为 1" rows={local.axes} columns={local.axes} values={local.attention}/><caption>每个 token 的 Q 对所有 K 打分，经 softmax 后汇聚 V。</caption></if>
<if test={local.tab=="FFN显微镜"}>
 <heatmap label="token × 隐藏神经元 · 点击一个激活" rows={local.axes} columns={local.hidden} values={local.activation} selectedRow={string(local.token)} selectedColumn={string(local.neuron)} onSelect="neuron"/>
 <caption>共享 W₁，token 以输入贡献激活 h{local.neuron+1}；权重本身不改变。</caption>
 <chart label="四维输入对当前神经元的贡献" data={local.contributions}/>
 <caption>贡献和 + 偏置 {formatNumber(local.bias,3)} = {formatNumber(local.z,3)} → GELU {formatNumber(local.activated,3)}</caption>
</if>
<if test={local.tab=="输入设置"}>
 ${field('sentence','句子（空格分 token，最多六个）')}
 <slider label="输入第一维扰动" min={-2} max={2} step={0.25} value={local.delta} onChange="field" args={{name:"delta"}}/>
 <toggle label="启用两条残差连接" checked={local.residual} onChange="residual"/>${button('reset','重置实验')}
 <caption>固定教学权重：4 → 6 → 4；Pre-LN。不是已训练模型，不输出真实语言预测。</caption>
</if>
</region>`
};

export function baselineSource(id){
 const tools=bindings[id],seed=SEEDS[id],bridges=Object.fromEntries(Object.keys(tools).map(op=>[op,'request-'+op]));
 for(const action of ['select','focus','choose','video'])bridges[action]='expose';
 const declarations=Object.entries(tools).map(([op,[tool,initial]])=>`
 <state id="input-${op}" type="record" initial={${q(initial)}}/>
 <binding id="${op}" tool="${tool}" input={state["input-${op}"]} ${tool==='glm.generate'?'':`initial={${q(empty)}}`} load="manual"/>
 <action id="request-${op}"><set target="input-${op}" value={event.result.request}/><invoke binding="${op}" input={next["input-${op}"]} onSuccess="success-${op}" onError="error-${op}"/></action>
 <action id="success-${op}"><set target="response" value={{seq:(state.response.seq??0)+1,op:"${op}",ok:true,value:event.result,input:event.input}}/></action>
 <action id="error-${op}"><set target="response" value={{seq:(state.response.seq??0)+1,op:"${op}",ok:false,error:event.error,input:event.input}}/></action>`).join('\n');
 return `<card schemaVersion="1" actionMode="snapshot" theme="soft" palette="${id==='sentiment'?'b':'a'}">
 <state id="response" type="record" initial={{seq:0}}/><state id="external" type="string" initial=""/>
 ${declarations}
 <title>${names[id]}</title>
 <logic id="baseline" label="${names[id]}交互" grow={true} reactive={true} initial={${q(seed)}} input={{response:state.response,today:context.localDate,statuses:{${Object.keys(tools).map(op=>op+':(bindings.'+op+'.status=="cancelled"?"cancelled":"")').join(',')}}${id==='family'?',planSchema:'+q(FAMILY_SCHEMA):''}}} source={${q(SOURCES[id])}} actions={${q(bridges)}}>
 ${ui[id]}
 </logic>
 <action id="expose"><set target="external" value={event.result.external}/></action>
 <if test={state.external!=""||${id==='movies'||id==='trains'}}><row wrap space="tight"><if test={state.external!=""}><link url={state.external}>打开所选来源 ↗</link></if>
 ${id==='movies'?'<link url="https://www.maoyan.com/">猫眼购票入口 ↗</link>':''}
 ${id==='trains'?'<link url="https://kyfw.12306.cn/otn/leftTicket/init">12306 官方购票 ↗</link>':''}
 </row></if>
 </card>`;
}
export const BASELINE_CARDS=Object.keys(SEEDS).map(id=>({id,title:names[id],source:baselineSource(id)}));
