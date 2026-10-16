declare module 'claude-code' {
  interface PluginState {
    'file-links': { files: string[] }
  }
}

export type FileLinksFiles = string[]
