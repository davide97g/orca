import { describe, expect, it } from 'vitest'
import { resolveBranchSyncIndicator } from './branch-sync-indicator-model'

describe('resolveBranchSyncIndicator', () => {
  it('stays unknown until upstream status resolves', () => {
    expect(resolveBranchSyncIndicator(undefined)).toEqual({ kind: 'unknown' })
  })

  it('offers publish when the branch has no upstream', () => {
    expect(resolveBranchSyncIndicator({ hasUpstream: false, ahead: 0, behind: 0 })).toEqual({
      kind: 'publish'
    })
  })

  it('reports ahead/behind counts against the upstream', () => {
    expect(
      resolveBranchSyncIndicator({
        hasUpstream: true,
        upstreamName: 'origin/develop',
        ahead: 2,
        behind: 10
      })
    ).toEqual({
      kind: 'sync',
      ahead: 2,
      behind: 10,
      upstreamName: 'origin/develop',
      forcePushWithLease: false
    })
  })

  it('flags force-push-with-lease when upstream-only commits are stale rebased copies', () => {
    const indicator = resolveBranchSyncIndicator({
      hasUpstream: true,
      ahead: 3,
      behind: 3,
      behindCommitsArePatchEquivalent: true
    })
    expect(indicator).toMatchObject({ kind: 'sync', upstreamName: null, forcePushWithLease: true })
  })
})
