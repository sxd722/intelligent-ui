export const weatherJournal = `<intro>自行填写的天气记录，不是气象数据源。</intro>
<card schemaVersion="1" actionMode="snapshot" theme="soft" palette="a">
<data id="options" value={[“晴”,“多云”,“雨”,“雪”,“风”,“雾霾”]}/>
<state id="month" type="string" initial="2026-10"/>
<state id="selected" type="string" initial="2026-10-13"/>
<state id="records" type="record" initial={{}}/>
<state id="marked" type="array" initial={[]}/>
<state id="draft" type="string" initial=""/>
<state id="note" type="string" initial=""/>
<action id="pick"><set target="selected" value={event.date}/><set target="draft" value={state.records[event.date].weather??""}/><set target="note" value={state.records[event.date].note??""}/></action>
<action id="month"><set target="month" value={event.month}/><set target="selected" value={event.date}/><set target="draft" value={state.records[event.date].weather??""}/><set target="note" value={state.records[event.date].note??""}/></action>
<action id="draft"><set target="draft" value={args.w}/></action>
<action id="note"><set target="note" value={event.value}/></action>
<action id="save"><set target="records" key={state.selected} value={{weather:state.draft,note:state.note}} when={state.draft!=""}/><append target="marked" value={state.selected} when={state.draft!="" &amp;&amp; !includes(state.marked,state.selected)}/></action>
<action id="clear"><set target="records" key={state.selected} value={null}/><set target="marked" value={filter(state.marked,item!=state.selected)}/><set target="draft" value=""/><set target="note" value=""/></action>
<calendar id="calendar" label="天气日历" month={state.month} selectedDate={state.selected} markedDates={state.marked} onSelect="pick" onMonthChange="month"/>
<region id="detail" role="content" overflow="scroll" resetKey={state.selected} label="当日记录">
<strong>{state.selected}</strong><text>{state.records[state.selected]!=null?"天气："+state.records[state.selected].weather+" · "+state.records[state.selected].note:"当天尚无记录"}</text>
<chips label="选择天气"><each items={data.options} as="opt" itemKey={opt}><chip label={opt} selected={state.draft==opt} onPress="draft" args={{w:opt}}/></each></chips>
<input label="备注" value={state.note} onChange="note"/>
</region>
<region role="actions"><row><button onPress="save" disabled={state.draft==""} variant="primary">保存记录</button><button onPress="clear" disabled={state.records[state.selected]==null}>清除</button></row></region>
</card><outro>日期标记与记录同步；换日和换月会加载对应草稿。</outro>`

export const conceptLab = `<intro>先做预测，再切换条件，观察结果。数值为教学模型。</intro>
<card actionMode="snapshot" theme="playful" palette="a" visualStyle="tinted-glass" backgroundQuery="colorful paper geometric shapes">
<data id="pages" value={[{id:"queue",name:"01 / 堵车的不是马路",hook:"请求像顾客排队，队伍长不代表厨师忙得过来。",example:"每分钟来12单，只能做8单，会怎样？"},{id:"cache",name:"02 / 先装好的便当",hook:"缓存让重复请求直接取餐，代价是便当可能不够新鲜。",example:"切换到缓存模式，看看每分钟积压如何变化。"},{id:"tradeoff",name:"03 / 没有免费午餐",hook:"多开窗口增加吞吐，却需要更多资源。",example:"你的选择：接受一点等待，还是多开一个窗口？"}]}/>
<state id="mode" type="string" initial="现场制作"/><state id="revealed" type="boolean" initial={false}/>
<derive id="capacity" value={state.mode=="现场制作"?8:16}/>
<action id="mode"><set target="mode" value={event.value}/></action><action id="reveal"><toggle target="revealed"/></action>
<carousel label="排队这件小事"><each items={data.pages} itemKey={item.id}><carousel-item><badge>生活里的计算机</badge><title size="small">{item.name}</title><text>{item.hook}</text><caption>{item.example}</caption></carousel-item></each></carousel>
<region role="content"><segmented label="服务方式" value={state.mode} options={["现场制作","缓存取餐"]} onChange="mode"/><row justify="between"><strong>{state.mode}</strong><button onPress="reveal">{state.revealed?"收起答案":"猜完了，看结果"}</button></row><text>{state.revealed?(derived.capacity>=12?"队伍不再增长：缓存救场，但记得处理过期数据。":"每分钟积压4单：厨师没有分身术。"):"先猜一猜：队伍会越来越长吗？"}</text></region>
</card><outro>切换条件产生不同结果；翻页只是浏览，不承担实验状态。</outro>`

export const packingLab = `<intro>出门轻一点，还是有备无患？这是选择代价的演示，不是装备建议。</intro>
<card actionMode="snapshot" theme="editorial" palette="b" visualStyle="photo-glass" backgroundQuery="hiking backpack forest">
<data id="items" value={[{id:"camera",label:"相机",weight:3,reply:"照片有了，肩膀也有意见了。"},{id:"coat",label:"外套",weight:2,reply:"天气突变时，你会感谢这个决定。"},{id:"book",label:"厚书",weight:4,reply:"精神食粮，物理重量。"}]}/>
<state id="picked" type="record" initial={{}}/><state id="feedback" type="string" initial="背包承重6格；试着做个取舍。"/>
<derive id="weight" value={sum(data.items,state.picked[item.id]?item.weight:0)}/>
<action id="pick"><toggle target="picked" key={args.id}/><set target="feedback" value={state.picked[args.id]?"把它留在家里，也是一个决定。":args.reply}/></action>
<title>背包委员会</title><caption>每一件“万一用得上”，都在竞选你的肩膀。</caption>
<row wrap><each items={data.items} itemKey={item.id}><chip label={item.label+" · "+item.weight+"格"} selected={state.picked[item.id]??false} onPress="pick" args={item}/></each></row>
<progress value={min(derived.weight/6,1)} label="背包负担"/><strong>{derived.weight>6?"委员会宣布：肩膀辞职。":derived.weight==6?"刚刚好，别再塞一块石头。":"还剩 "+(6-derived.weight)+" 格余地"}</strong><text>{state.feedback}</text>
</card><outro>任意组合都能撤销；反馈与选择相关，不添加无关随机数。</outro>`

export const EXPERIENCE_FIXTURES={weatherJournal,conceptLab,packingLab}
