import { describe, expect, it } from 'vitest'
import { buildGitBranchCheckoutArgv, parseGitBranchCheckoutCreate } from './git-branch-checkout'

describe('buildGitBranchCheckoutArgv', () => {
  it('switches to an existing branch', () => {
    expect(buildGitBranchCheckoutArgv({ branch: 'feature/a' })).toEqual([
      'checkout',
      'feature/a',
      '--'
    ])
  })

  it('creates a branch from HEAD', () => {
    expect(buildGitBranchCheckoutArgv({ branch: 'feature/a', create: {} })).toEqual([
      'checkout',
      '-b',
      'feature/a',
      '--'
    ])
  })

  it('creates a tracking branch from a remote ref', () => {
    expect(
      buildGitBranchCheckoutArgv({
        branch: 'feature/a',
        create: { startPoint: 'origin/feature/a', track: true }
      })
    ).toEqual(['checkout', '-b', 'feature/a', '--track', 'origin/feature/a', '--'])
  })

  it('ignores track without a start point', () => {
    expect(buildGitBranchCheckoutArgv({ branch: 'a', create: { track: true } })).toEqual([
      'checkout',
      '-b',
      'a',
      '--'
    ])
  })

  it('rejects option-shaped tokens', () => {
    expect(() => buildGitBranchCheckoutArgv({ branch: '--orphan' })).toThrow('invalid_branch_name')
    expect(() => buildGitBranchCheckoutArgv({ branch: '' })).toThrow('invalid_branch_name')
    expect(() => buildGitBranchCheckoutArgv({ branch: 'a', create: { startPoint: '-f' } })).toThrow(
      'invalid_start_point'
    )
  })
})

describe('parseGitBranchCheckoutCreate', () => {
  it('keeps only well-typed fields', () => {
    expect(parseGitBranchCheckoutCreate({ startPoint: 'origin/a', track: true })).toEqual({
      startPoint: 'origin/a',
      track: true
    })
    expect(parseGitBranchCheckoutCreate({ startPoint: 1, track: 'yes' })).toEqual({})
  })

  it('treats a missing or non-object value as no create request', () => {
    expect(parseGitBranchCheckoutCreate(undefined)).toBeUndefined()
    expect(parseGitBranchCheckoutCreate(null)).toBeUndefined()
    expect(parseGitBranchCheckoutCreate('yes')).toBeUndefined()
  })
})
