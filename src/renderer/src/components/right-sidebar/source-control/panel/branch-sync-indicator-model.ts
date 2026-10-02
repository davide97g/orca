import type { GitUpstreamStatus } from '../../../../../../shared/git-status-types'
import { shouldForcePushWithLeaseForUpstream } from '../../../../../../shared/git-upstream-status'

export type BranchSyncIndicator =
  // Why: undefined status = not fetched yet; render nothing rather than flash "Publish".
  | { kind: 'unknown' }
  | { kind: 'publish' }
  | {
      kind: 'sync'
      ahead: number
      behind: number
      upstreamName: string | null
      forcePushWithLease: boolean
    }

export function resolveBranchSyncIndicator(
  status: GitUpstreamStatus | undefined
): BranchSyncIndicator {
  if (!status) {
    return { kind: 'unknown' }
  }
  if (!status.hasUpstream) {
    return { kind: 'publish' }
  }
  return {
    kind: 'sync',
    ahead: status.ahead,
    behind: status.behind,
    upstreamName: status.upstreamName ?? null,
    forcePushWithLease: shouldForcePushWithLeaseForUpstream(status)
  }
}
