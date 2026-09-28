import { describe, expect, it } from 'vitest'
import { buildBranchSwitchCandidates } from './branch-switch-candidates'

const base = {
  localBranches: ['main', 'feat/a', 'feat/b'],
  currentBranch: 'main',
  remoteRefs: [],
  siblingWorktrees: [],
  query: ''
}

describe('buildBranchSwitchCandidates', () => {
  it('lists local branches and marks the current one', () => {
    const result = buildBranchSwitchCandidates(base)
    expect(result.local.map((entry) => [entry.branch, entry.isCurrent])).toEqual([
      ['main', true],
      ['feat/a', false],
      ['feat/b', false]
    ])
    expect(result.createName).toBeNull()
  })

  it('filters case-insensitively and offers creating an unknown name', () => {
    const result = buildBranchSwitchCandidates({ ...base, query: ' FEAT/A ' })
    expect(result.local.map((entry) => entry.branch)).toEqual(['feat/a'])
    expect(result.createName).toBe('FEAT/A')
  })

  it('does not offer creating an existing or option-shaped name', () => {
    expect(buildBranchSwitchCandidates({ ...base, query: 'feat/a' }).createName).toBeNull()
    expect(buildBranchSwitchCandidates({ ...base, query: '-x' }).createName).toBeNull()
  })

  it('flags branches checked out in another workspace, never the current one', () => {
    const result = buildBranchSwitchCandidates({
      ...base,
      siblingWorktrees: [
        { id: 'wt-b', displayName: 'B workspace', branch: 'feat/b' },
        { id: 'wt-main', displayName: 'Main copy', branch: 'main' },
        { id: 'wt-detached', displayName: 'Detached', branch: '' }
      ]
    })
    expect(result.local.find((entry) => entry.branch === 'feat/b')?.checkedOutIn).toEqual({
      worktreeId: 'wt-b',
      displayName: 'B workspace'
    })
    expect(result.local.find((entry) => entry.branch === 'main')?.checkedOutIn).toBeNull()
  })

  it('keeps only remote refs without a local counterpart', () => {
    const result = buildBranchSwitchCandidates({
      ...base,
      remoteRefs: [
        { refName: 'feat/a', localBranchName: 'feat/a' },
        { refName: 'origin/feat/a', localBranchName: 'feat/a' },
        { refName: 'origin/feat/c', localBranchName: 'feat/c' },
        { refName: 'origin/feat/c', localBranchName: 'feat/c' },
        { refName: 'upstream/fix', localBranchName: 'fix' }
      ],
      query: 'feat'
    })
    expect(result.remote).toEqual([{ refName: 'origin/feat/c', localBranchName: 'feat/c' }])
  })
})
