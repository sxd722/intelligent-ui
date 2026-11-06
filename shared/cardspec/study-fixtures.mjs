const books=[{id:'dream',title:'红楼梦',author:'曹雪芹',kind:'古典文学',description:'从人物关系进入故事：选择一种阅读角度，再回到原文寻找支持它的细节。'},
 {id:'solitude',title:'百年孤独',author:'加西亚·马尔克斯',kind:'魔幻现实主义',description:'观察重复的名字、记忆与家族循环，试着画一张人物关系图。'},
 {id:'brothers',title:'卡拉马佐夫兄弟',author:'陀思妥耶夫斯基',kind:'思想小说',description:'把不同人物的观点并置阅读。这里故意提供一段较长的测试说明，用来验证窄屏时摘要有明确的完整阅读入口，而不是把超出空间的内容永久裁掉。选择、换组和打开详情都不应更改已经选中的书。'},
 {id:'stranger',title:'局外人',author:'加缪',kind:'现代文学',description:'留意叙述者说了什么，也留意他没有说什么。'},
 {id:'pride',title:'傲慢与偏见',author:'简·奥斯汀',kind:'世情小说',description:'比较人物首次登场时的判断与后来发生的变化。'},
 {id:'sea',title:'老人与海',author:'海明威',kind:'极简主义',description:'从简短的对话和动作中，寻找未被直接说出的情绪。'},
 {id:'metamorph',title:'变形记',author:'卡夫卡',kind:'现代主义',description:'对照变形前后的家庭分工和态度，形成自己的解释。'}]
const spread=(items,extra='')=>`<card design="academy"><title>文学的另一面</title><caption>选择一本 · 从一个角度开始阅读</caption><data id="books" value={${JSON.stringify(items)}}/><state id="selected" type="string" initial="dream"/><collection label="阅读星图" presentation="spread" items={data.books} titleKey="title" subtitleKey="description" fields={["author","kind"]} selectedId={state.selected} onSelect="pick"/><button onPress="save">{state.selected}</button><action id="pick"><set target="selected" value={event.id}/></action><action id="save"><set target="selected" value={state.selected}/></action>${extra}</card>`
export const STUDY_FIXTURES={
 academyBooks:spread(books),
 academyTrinity:spread(books.filter(b=>['dream','solitude','sea'].includes(b.id))),
 academyImageFailure:spread(books.slice(0,2).map(b=>({...b,assetRef:'asset.v1.invalid.invalid'}))),
 academyList:`<card design="academy"><title>选择一个阅读入口</title><state id="selected" type="string" initial="未选择"/><list label="阅读角度"><list-item onPress="pick" args={{title:"人物关系"}}><strong>人物关系</strong><caption>谁在影响谁，关系如何变化</caption></list-item><list-item onPress="pick" args={{title:"叙事视角"}}><strong>叙事视角</strong><caption>同一件事，换个人会怎样讲述</caption></list-item><list-item><checkbox label="保留我的阅读笔记" checked={false}/></list-item></list><text>{state.selected}</text><action id="pick"><set target="selected" value={args.title}/></action></card>`
}
