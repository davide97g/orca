import type { PreloadApi } from '../../../../preload/api-types'
import { toRuntimeWorktreeSelector } from '../../runtime/runtime-worktree-selector'
import { callRuntimeResult } from './web-runtime-calls'
import { resolveRuntimeWorktreeByPath } from './web-runtime-worktree-catalog'

type WebGitBranchApi = Pick<NonNullable<PreloadApi['git']>, 'localBranches' | 'checkout'>

export function createGitBranchApi(): WebGitBranchApi {
  return {
    localBranches: async ({ worktreePath }) => {
      const worktree = await resolveRuntimeWorktreeByPath(worktreePath)
      return callRuntimeResult('git.localBranches', {
        worktree: toRuntimeWorktreeSelector(worktree.id)
      })
    },
    checkout: async ({ worktreePath, branch, create }) => {
      const worktree = await resolveRuntimeWorktreeByPath(worktreePath)
      await callRuntimeResult('git.checkout', {
        worktree: toRuntimeWorktreeSelector(worktree.id),
        branch,
        ...(create ? { create } : {})
      })
    }
  }
}
