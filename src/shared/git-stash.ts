/**
 * Source Control stash support shared by the local IPC handler, the runtime RPC and the SSH relay,
 * so every host lists stashes and builds `git stash` argv the same way.
 */
export type GitStashEntry = {
  /** Position in `git stash list`; `stash@{index}`. */
  index: number
  /** Commit id of the stash, so a mutation can verify `stash@{index}` was not shifted under it. */
  oid: string
  /** Unix seconds the stash was created. */
  createdAt: number
  /** Branch the stash was made on; null when it was made on a detached HEAD. */
  branch: string | null
  /** User message, or the "<short-sha> <subject>" git records for a message-less stash. */
  message: string
}

export type GitStashList = { entries: GitStashEntry[] }

/** `tracked` = `git stash`, `include-untracked` = `-u`, `staged` = `--staged` (git 2.35+). */
export type GitStashPushMode = 'tracked' | 'include-untracked' | 'staged'

export type GitStashEntryAction = 'apply' | 'pop' | 'drop'

export type GitStashMutation =
  | { kind: 'push'; mode: GitStashPushMode; message?: string }
  | { kind: GitStashEntryAction; index: number; oid: string }
  | { kind: 'clear' }

export type GitStashMutationResult = {
  ok: true
  /** False when `push` found nothing to stash ("No local changes to save"). */
  changed: boolean
}

type GitStashExec = (argv: string[]) => Promise<{ stdout: string; stderr: string }>

const FIELD_SEPARATOR = '\x1f'
const STASH_LIST_ARGV = ['stash', 'list', '--format=%H%x1f%ct%x1f%gs']
const STASH_SUBJECT_PATTERN = /^(?:WIP on|On) (.+?): (.*)$/
const NO_LOCAL_CHANGES_PATTERN = /No local changes to save/
const OID_PATTERN = /^[0-9a-f]{40,64}$/

export function parseGitStashList(stdout: string): GitStashEntry[] {
  const entries: GitStashEntry[] = []
  for (const line of stdout.split('\n')) {
    const [oid, createdAt, subject] = line.split(FIELD_SEPARATOR)
    if (!oid || subject === undefined) {
      continue
    }
    // Why: git refnames cannot contain ':', so the first ": " always ends the branch name.
    const match = STASH_SUBJECT_PATTERN.exec(subject)
    const branch = match?.[1] ?? null
    entries.push({
      index: entries.length,
      oid,
      createdAt: Number.parseInt(createdAt ?? '', 10) || 0,
      branch: branch === '(no branch)' ? null : branch,
      message: match ? (match[2] ?? '') : subject
    })
  }
  return entries
}

export function buildGitStashPushArgv(mode: GitStashPushMode, message?: string): string[] {
  const trimmed = message?.trim()
  return [
    'stash',
    'push',
    ...(mode === 'include-untracked' ? ['--include-untracked'] : []),
    ...(mode === 'staged' ? ['--staged'] : []),
    // Why: `-m` consumes the next argv token as its value, so a `-`-prefixed message is not a flag.
    ...(trimmed ? ['-m', trimmed] : [])
  ]
}

function assertStashIndex(index: number): void {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new Error('invalid_stash_index')
  }
}

export function buildGitStashEntryArgv(action: GitStashEntryAction, index: number): string[] {
  assertStashIndex(index)
  return ['stash', action, `stash@{${index}}`]
}

export async function listGitStashes(git: GitStashExec): Promise<GitStashList> {
  const { stdout } = await git(STASH_LIST_ARGV)
  return { entries: parseGitStashList(stdout) }
}

/**
 * Runs one stash mutation. Entry actions first confirm `stash@{index}` still names the stash the
 * user picked: a `git stash` from a terminal shifts every index, and pop/drop need the reflog
 * selector, so a stale index would otherwise act on the wrong stash.
 */
export async function runGitStashMutation(
  git: GitStashExec,
  mutation: GitStashMutation
): Promise<GitStashMutationResult> {
  if (mutation.kind === 'push') {
    const { stdout, stderr } = await git(buildGitStashPushArgv(mutation.mode, mutation.message))
    return { ok: true, changed: !NO_LOCAL_CHANGES_PATTERN.test(`${stdout}\n${stderr}`) }
  }
  if (mutation.kind === 'clear') {
    await git(['stash', 'clear'])
    return { ok: true, changed: true }
  }
  const argv = buildGitStashEntryArgv(mutation.kind, mutation.index)
  // Why: `--verify --quiet` exits non-zero when the index no longer exists; same outcome as a shift.
  const current = await git(['rev-parse', '--verify', '--quiet', `stash@{${mutation.index}}`]).then(
    ({ stdout }) => stdout.trim(),
    () => null
  )
  if (current !== mutation.oid) {
    throw new Error('The stash list changed. Refresh and try again.')
  }
  await git(argv)
  return { ok: true, changed: true }
}

function readField(value: object, key: string): unknown {
  return key in value ? Reflect.get(value, key) : undefined
}

/** Parses the relay/IPC wire shape; throws on anything that is not a well-formed mutation. */
export function parseGitStashMutation(value: unknown): GitStashMutation {
  if (typeof value !== 'object' || value === null) {
    throw new Error('invalid_stash_mutation')
  }
  const kind = readField(value, 'kind')
  if (kind === 'push') {
    const mode = readField(value, 'mode')
    const message = readField(value, 'message')
    if (mode !== 'tracked' && mode !== 'include-untracked' && mode !== 'staged') {
      throw new Error('invalid_stash_mutation')
    }
    return { kind, mode, ...(typeof message === 'string' ? { message } : {}) }
  }
  if (kind === 'apply' || kind === 'pop' || kind === 'drop') {
    const index = readField(value, 'index')
    const oid = readField(value, 'oid')
    if (typeof index !== 'number' || typeof oid !== 'string' || !OID_PATTERN.test(oid)) {
      throw new Error('invalid_stash_mutation')
    }
    assertStashIndex(index)
    return { kind, index, oid }
  }
  if (kind === 'clear') {
    return { kind }
  }
  throw new Error('invalid_stash_mutation')
}
