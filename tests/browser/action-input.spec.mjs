import { test, expect } from '@playwright/test'

test('parameter-driven list selection survives category changes at mobile width', async ({ page }) => {
  await page.goto('/cardspec-lab.html')
  await page.getByLabel('宽度', { exact: true }).selectOption('320')
  await page.getByText('输入 DSL 验证', { exact: true }).click()
  await page.getByLabel('DSL源码').fill(`<card>
    <data id="entries" value={[{"id":"a","group":"one","title":"First","text":"First detail"},{"id":"b","group":"one","title":"Second","text":"Second detail"},{"id":"c","group":"two","title":"Third","text":"Third detail"}]}/>
    <state id="group" type="string" initial="one"/><state id="selection" type="string" initial=""/>
    <derive id="visible" value={filter(data.entries,item.group==state.group)}/>
    <derive id="current" value={find(derived.visible,item.id==state.selection) ?? derived.visible[0]}/>
    <action id="choose"><set target="selection" value={args.id}/></action>
    <action id="switchGroup"><set target="group" value={args.group}/><set target="selection" value=""/></action>
    <row id="groups"><chip id="one" label="Group one" onPress="switchGroup" args={{"group":"one"}}/><chip id="two" label="Group two" onPress="switchGroup" args={{"group":"two"}}/></row>
    <region id="list" overflow="scroll"><each id="entriesList" items={derived.visible} itemKey={item.id}><pressable id="entry" selected={state.selection==item.id} onPress="choose" args={{"id":item.id}}><text id="title">{item.title}</text></pressable></each></region>
    <text id="detail">{derived.current.text}</text>
  </card>`)
  await page.getByRole('button', { name: '应用源码' }).click()
  await page.getByRole('button', { name: '模拟结束' }).click()
  await expect(page.getByTestId('diagnostics')).toHaveText('[]')
  await page.getByRole('button', { name: 'Second', exact: true }).click()
  await expect(page.locator('.cs-card')).toContainText('Second detail')
  await page.getByRole('button', { name: 'Group two', exact: true }).click()
  await expect(page.locator('.cs-card')).toContainText('Third detail')
  await page.getByRole('button', { name: 'Group one', exact: true }).click()
  await expect(page.locator('.cs-card')).toContainText('First detail')
  await page.getByRole('button', { name: 'Second', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.cs-card')).toContainText('Second detail')
  await expect(page.locator('[data-cs-error]')).toHaveCount(0)
  await expect(page.locator('.cs-stage')).toHaveAttribute('data-cs-fit', 'fit')
})
