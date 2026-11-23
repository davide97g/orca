import { describe, expect, it, vi } from 'vitest'
import {
  buildGitStashEntryArgv,
  buildGitStashPushArgv,
  parseGitStashList,
  parseGitStashMutation,
  runGitStashMutation
} from './git-stash'

const OID_A = 'a'.repeat(40)
const OID_B = 'b'.repeat(40)

describe('parseGitStashList', () => {
  it('reads message, branch and creation time per entry in list order', () => {
    const stdout = [
      `${OID_A}\x1f1700000000\x1fOn feature/x: wip: half done`,
      `${OID_B}\x1f1690000000\x1fWIP on main: 1234567 Add thing`,
      ''
    ].join('\n')
    expect(parseGitStashList(stdout)).toEqual([
      {
        index: 0,
        oid: OID_A,
        createdAt: 1700000000,
        branch: 'feature/x',
        message: 'wip: half done'
      },
      { index: 1, oid: OID_B, createdAt: 1690000000, branch: 'main', message: '1234567 Add thing' }
    ])
  })

  it('reports a detached-HEAD stash without a branch', () => {
    expect(parseGitStashList(`${OID_A}\x1f1\x1fOn (no branch): x`)[0]?.branch).toBeNull()
  })

  it('keeps an unrecognised subject as the message', () => {
    expect(parseGitStashList(`${OID_A}\x1f1\x1fcustom subject`)[0]).toMatchObject({
      branch: null,
      message: 'custom subject'
    })
  })
})

describe('stash argv', () => {
  it('builds push variants', () => {
    expect(buildGitStashPushArgv('tracked')).toEqual(['stash', 'push'])
    expect(buildGitStashPushArgv('include-untracked', '  msg  ')).toEqual([
      'stash',
      'push',
      '--include-untracked',
      '-m',
      'msg'
    ])
    expect(buildGitStashPushArgv('staged', '--all')).toEqual([
      'stash',
      'push',
      '--staged',
      '-m',
      '--all'
    ])
  })

  it('addresses entries by reflog selector and rejects bad indexes', () => {
    expect(buildGitStashEntryArgv('pop', 2)).toEqual(['stash', 'pop', 'stash@{2}'])
    expect(() => buildGitStashEntryArgv('drop', -1)).toThrow('invalid_stash_index')
    expect(() => buildGitStashEntryArgv('drop', 1.5)).toThrow('invalid_stash_index')
  })
})

describe('runGitStashMutation', () => {
  it('reports a push with nothing to stash as unchanged', async () => {
    const git = vi.fn().mockResolvedValue({ stdout: 'No local changes to save\n', stderr: '' })
    await expect(runGitStashMutation(git, { kind: 'push', mode: 'tracked' })).resolves.toEqual({
      ok: true,
      changed: false
    })
  })

  it('runs an entry action only when the index still names the picked stash', async () => {
    const git = vi.fn().mockResolvedValue({ stdout: `${OID_A}\n`, stderr: '' })
    await runGitStashMutation(git, { kind: 'pop', index: 0, oid: OID_A })
    expect(git).toHaveBeenLastCalledWith(['stash', 'pop', 'stash@{0}'])

    const shifted = vi.fn().mockResolvedValue({ stdout: `${OID_B}\n`, stderr: '' })
    await expect(
      runGitStashMutation(shifted, { kind: 'drop', index: 0, oid: OID_A })
    ).rejects.toThrow('The stash list changed')
    expect(shifted).toHaveBeenCalledTimes(1)
  })
})

describe('parseGitStashMutation', () => {
  it('accepts well-formed mutations', () => {
    expect(parseGitStashMutation({ kind: 'push', mode: 'staged', message: 'm' })).toEqual({
      kind: 'push',
      mode: 'staged',
      message: 'm'
    })
    expect(parseGitStashMutation({ kind: 'apply', index: 1, oid: OID_A })).toEqual({
      kind: 'apply',
      index: 1,
      oid: OID_A
    })
    expect(parseGitStashMutation({ kind: 'clear' })).toEqual({ kind: 'clear' })
  })

  it('rejects malformed mutations', () => {
    expect(() => parseGitStashMutation(null)).toThrow('invalid_stash_mutation')
    expect(() => parseGitStashMutation({ kind: 'push', mode: '--all' })).toThrow()
    expect(() => parseGitStashMutation({ kind: 'drop', index: 0, oid: '--force' })).toThrow()
    expect(() => parseGitStashMutation({ kind: 'drop', index: -1, oid: OID_A })).toThrow()
    expect(() => parseGitStashMutation({ kind: 'show' })).toThrow()
  })
})
