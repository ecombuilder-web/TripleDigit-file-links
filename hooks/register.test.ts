import { expect, test } from 'claude-code/testing'

const PANE = { requestId: 'file-links' } as const

test('a Write call puts its file in the Files pane', async ($, on) => {
  on('tool.call', () => ({ result: {}, text: 'ok' }) as never)
  await $.tool.call({ tool: 'Write', file_path: 'C:/tmp/notes/report.md', content: 'x' } as never)

  const ui = await $.ui.mount({ plugin: 'file-links', surface: 'desktop', component: 'Pane', props: PANE as never, requestId: 'file-links' })
  expect(await ui.find({ type: 'Button', text: 'report.md' })).toBeDefined()
})

test('the pane starts empty', async ($) => {
  const ui = await $.ui.mount({ plugin: 'file-links', surface: 'desktop', component: 'Pane', props: PANE as never, requestId: 'file-links' })
  expect(await ui.find({ type: 'Text', text: 'No files yet' })).toBeDefined()
})

test('a denied Write is not listed', async ($, on) => {
  on('tool.call', () => ({ deny: 'no' }) as never)
  await $.tool.call({ tool: 'Write', file_path: 'C:/tmp/notes/blocked.md', content: 'x' } as never)

  const ui = await $.ui.mount({ plugin: 'file-links', surface: 'desktop', component: 'Pane', props: PANE as never, requestId: 'file-links' })
  expect(await ui.find({ type: 'Button', text: 'blocked.md' })).toBeUndefined()
})
