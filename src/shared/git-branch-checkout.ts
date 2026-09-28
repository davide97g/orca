/**
 * Branch switch request shared by the local IPC handler, the runtime RPC and the SSH relay so
 * every host builds the identical `git checkout` argv.
 */
export type GitBranchCheckoutCreate = {
  /** Ref the new branch starts at; omitted means the current HEAD. */
  startPoint?: string
  /** Set the new branch's upstream to `startPoint` (used for remote-tracking refs). */
  track?: boolean
}

export type GitBranchCheckoutRequest = {
  branch: string
  /** Present to create `branch` (`checkout -b`) instead of switching to an existing one. */
  create?: GitBranchCheckoutCreate
}

function assertSafeCheckoutToken(value: string, error: string): void {
  // Why: a `-`-prefixed token would be parsed as a git option (arg injection).
  if (value.length === 0 || value.startsWith('-')) {
    throw new Error(error)
  }
}

export function buildGitBranchCheckoutArgv(request: GitBranchCheckoutRequest): string[] {
  assertSafeCheckoutToken(request.branch, 'invalid_branch_name')
  const { create } = request
  if (!create) {
    // Why: trailing `--` pins the token as a ref; git's DWIM still turns a remote-only name
    // into a tracking branch, which mobile relies on.
    return ['checkout', request.branch, '--']
  }
  if (create.startPoint !== undefined) {
    assertSafeCheckoutToken(create.startPoint, 'invalid_start_point')
  }
  return [
    'checkout',
    '-b',
    request.branch,
    ...(create.track && create.startPoint ? ['--track'] : []),
    ...(create.startPoint ? [create.startPoint] : []),
    '--'
  ]
}

/** Parses the relay/IPC wire shape, dropping anything that is not a well-formed create request. */
export function parseGitBranchCheckoutCreate(value: unknown): GitBranchCheckoutCreate | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }
  const startPoint = 'startPoint' in value ? value.startPoint : undefined
  const track = 'track' in value ? value.track : undefined
  return {
    ...(typeof startPoint === 'string' ? { startPoint } : {}),
    ...(track === true ? { track: true } : {})
  }
}
