export const DIL_MULTILINE = `商品分类浏览。

{@body const [selected,setSelected]=DIL.useState("all")}
{@body const categories=[{id:"all",label:"全部"},{id:"tools",label:"工具"},{id:"books",label:"读物"},{id:"empty",label:"其它"}]}
{@body const items=[
  {id:"a",name:"铅笔",categoryId:"tools",meta:{note:"书写工具 } {"}},
  // Braces in comments must not terminate the directive: }
  {id:"b",name:"尺子",categoryId:"tools",meta:{note:"测量工具"}},
  {id:"c",name:"图册",categoryId:"books",meta:{note:"参考读物"}}
]}
{@body const filteredItems=items.filter(it=>selected==="all" || it.categoryId===selected)}
<box>
  <row><title>分类目录</title><badge>{filteredItems.length} 项</badge></row>
  <chips>{#each categories as cat}<chip selected={selected===cat.id} onClick={()=>setSelected(cat.id)}>{cat.label}</chip>{/each}</chips>
  <grid columns={2}>{#each filteredItems as it}<grid-item key={it.id}><text>{it.name}</text></grid-item>{/each}</grid>
  {#if filteredItems.length===0}<text>暂无内容</text>{/if}
</box>

点击分类查看对应内容。`
