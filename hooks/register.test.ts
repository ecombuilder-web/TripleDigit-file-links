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

test('the search field filters the list by name', async ($, on) => {
  on('tool.call', () => ({ result: {}, text: 'ok' }) as never)
  await $.tool.call({ tool: 'Write', file_path: 'C:/tmp/a/report.md', content: 'x' } as never)
  await $.tool.call({ tool: 'Write', file_path: 'C:/tmp/a/video.mp4', content: 'x' } as never)

  const ui = await $.ui.mount({ plugin: 'file-links', surface: 'desktop', component: 'Pane', props: PANE as never, requestId: 'file-links' })
  expect(await ui.find({ type: 'Button', text: 'video.mp4' })).toBeDefined()

  await ui.input({ key: 'search', text: 'REPORT', kind: 'change' })
  expect(await ui.find({ type: 'Button', text: 'report.md' })).toBeDefined()
  expect(await ui.find({ type: 'Button', text: 'video.mp4' })).toBeUndefined()
})
