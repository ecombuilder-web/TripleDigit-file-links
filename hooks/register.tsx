import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const PANE = 'file-links'
const files = atom({ plugin: 'file-links', key: 'files' } as const, [] as string[])
const query = atom({ plugin: 'file-links', key: 'query' } as const, '')

const toWindows = (path: string) =>
  path.replace(/^\/([a-zA-Z])\//, '$1:/').replace(/\//g, '\\')
const split = (path: string) => {
  const cut = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'))
  return { name: path.slice(cut + 1), dir: path.slice(0, Math.max(cut, 0)) }
}

const TOKEN = /(?:"([^"]+)"|'([^']+)'|([^\s"'|&;<>()]+))/g
const dirOf = (p: string) => {
  const cut = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'))
  return cut > 0 ? p.slice(0, cut) : undefined
}
const candidates = (command: string) => {
  const out = new Set<string>()
  for (const m of command.matchAll(TOKEN)) {
    const t = m[1] ?? m[2] ?? m[3]
    if (t && /\.[A-Za-z0-9]{1,5}$/.test(t) && !t.startsWith('-') && !/^https?:/.test(t)) out.add(t)
  }
  return [...out]
}

const absolute = async ($: any, path: string) => {
  if (/^([a-zA-Z]:|\/|\\)/.test(path)) return path
  const stat = await $.fs.stat(path, { resolve: true }).catch(() => undefined)
  return stat?.realPath ?? path
}

const track = async ($: any, path: string | undefined) => {
  if (!path) return
  const full = toWindows(path)
  await update($, files, list => [full, ...list.filter(one => one !== full)].slice(0, 200))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'file-links', description: 'Show files made this session, with links to File Explorer' })
    void $.ui.open({ id: PANE, title: 'Files' })
    return next(e)
  })

  on('command.run', { command: 'file-links' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Files' })
    return { text: 'Files pane opened.' }
  })

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true) await track($, e.file_path)
    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true) await track($, e.file_path)
    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const t0 = (await $.clock.now()) - 1000
    const tokens = candidates(e.command)
    const ran = await next(e)
    if (ran.deny !== undefined) return ran

    const found = new Set<string>()
    const dirs = new Set<string>([''])
    for (const tok of tokens) {
      const stat = await $.fs.stat(tok).catch(() => undefined)
      if (stat?.kind === 'file' && stat.mtimeMs >= t0) found.add(tok)
      const d = dirOf(tok)
      if (d) dirs.add(d)
    }
    for (const m of e.command.matchAll(TOKEN)) {
      const t = m[1] ?? m[2] ?? m[3]
      if (!t || t.startsWith('-') || /^https?:/.test(t) || /[*?%]/.test(t)) continue
      const stat = await $.fs.stat(t).catch(() => undefined)
      if (stat?.kind === 'dir') dirs.add(t)
    }
    for (const d of [...dirs].slice(0, 10)) {
      const top = await $.fs.list(d || undefined).catch(() => [])
      for (const sub of top.filter(x => x.kind === 'dir').slice(0, 40)) {
        dirs.add(d ? `${d}/${sub.name}` : sub.name)
      }
    }
    for (const d of dirs) {
      const entries = await $.fs.list(d || undefined).catch(() => [])
      for (const f of entries) {
        if (f.kind === 'file' && f.mtimeMs >= t0) found.add(d ? `${d}/${f.name}` : f.name)
      }
    }
    for (const path of [...found].slice(0, 30)) await track($, await absolute($, path))
    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'NotebookEdit' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true) await track($, (e as any).notebook_path)
    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const Input = (els as any).Input as ((props: any) => any) | undefined
    const all = await read($, files)
    const q = await read($, query)
    const needle = q.trim().toLowerCase()
    const list = needle ? all.filter(path => path.toLowerCase().includes(needle)) : all

    return (
      <Box flexDirection="column">
        {Input && (
          <Input
            key="search"
            placeholder="Search files by name"
            value={q}
            onInput={(value: string) => {
              void update($, query, () => value)
            }}
            onSubmit={(value: string) => {
              void update($, query, () => value)
            }}
          />
        )}
        {all.length === 0 && <Text dimColor>No files yet this session.</Text>}
        {all.length > 0 && list.length === 0 && <Text dimColor>No file matches "{q}".</Text>}
        {list.map(path => {
          const { name, dir } = split(path)
          return (
            <Box key={path} flexDirection="column">
              <Button
                key={path}
                onPress={() => {
                  void $.process.run(['explorer.exe', `/select,${path}`])
                }}
              >
                {name}
              </Button>
              <Text dimColor>{dir}</Text>
            </Box>
          )
        })}
      </Box>
    )
  })
}
