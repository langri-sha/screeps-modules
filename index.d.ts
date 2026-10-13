declare namespace ScreepsModules {
  type Modules = Record<string, string | { binary: string }>

  interface Options {
    email?: string
    password?: string
    token?: string
    serverUrl?: string
    serverPassword?: string
    gzip?: boolean
  }

  interface CodeResponse {
    ok: number
    branch?: string
    modules?: Modules
  }

  interface RequestOptions {
    method?: string
    headers?: HeadersInit
    body?: BodyInit
    json?: unknown
    qs?: Record<string, string | undefined>
    signal?: AbortSignal
    timeout?: number
  }
}

declare class ScreepsModules {
  options: Required<ScreepsModules.Options>

  constructor(options?: ScreepsModules.Options)

  refreshToken(): Promise<string | undefined>

  commit(modules: ScreepsModules.Modules): Promise<ScreepsModules.CodeResponse>
  commit(
    branch: string,
    modules: ScreepsModules.Modules,
  ): Promise<ScreepsModules.CodeResponse>

  retrieve(branch?: string): Promise<ScreepsModules.CodeResponse>

  fetch(branch?: string): Promise<ScreepsModules.CodeResponse>
  up(modules: ScreepsModules.Modules): Promise<ScreepsModules.CodeResponse>
  up(
    branch: string,
    modules: ScreepsModules.Modules,
  ): Promise<ScreepsModules.CodeResponse>
  down(branch?: string): Promise<ScreepsModules.CodeResponse>
  push(modules: ScreepsModules.Modules): Promise<ScreepsModules.CodeResponse>
  push(
    branch: string,
    modules: ScreepsModules.Modules,
  ): Promise<ScreepsModules.CodeResponse>
  pull(branch?: string): Promise<ScreepsModules.CodeResponse>

  request(
    url: string,
    options?: ScreepsModules.RequestOptions,
  ): Promise<unknown>
}

export = ScreepsModules
