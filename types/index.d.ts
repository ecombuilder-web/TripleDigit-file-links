declare module 'claude-code' {
  interface PluginState {
    'file-links': { files: string[]; query: string }
  }
}

export type FileLinksFiles = string[]
