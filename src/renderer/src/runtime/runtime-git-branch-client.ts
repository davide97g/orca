import type { GitBranchCheckoutRequest } from '../../../shared/git-branch-checkout'
import type { RuntimeGitLocalBranches } from '../../../shared/runtime-types'
import { resolveLocalWorktreePath, type RuntimeGitContext } from './runtime-git-client-context'
import { callRuntimeRpc, getActiveRuntimeTarget } from './runtime-rpc-client'
import { toRuntimeWorktreeSelector } from './runtime-worktree-selector'

export async function listRuntimeGitLocalBranches(
  context: RuntimeGitContext
): Promise<RuntimeGitLocalBranches> {
  const target = getActiveRuntimeTarget(context.settings)
  if (target.kind === 'local' || !context.worktreeId) {
    return window.api.git.localBranches({
      worktreePath: resolveLocalWorktreePath(context),
      connectionId: context.connectionId
    })
  }
  return callRuntimeRpc<RuntimeGitLocalBranches>(
    target,
    'git.localBranches',
    { worktree: toRuntimeWorktreeSelector(context.worktreeId) },
    { timeoutMs: 15_000 }
  )
}

export async function checkoutRuntimeGitBranch(
  context: RuntimeGitContext,
  request: GitBranchCheckoutRequest
): Promise<void> {
  const target = getActiveRuntimeTarget(context.settings)
  if (target.kind === 'local' || !context.worktreeId) {
    await window.api.git.checkout({
      worktreePath: resolveLocalWorktreePath(context),
      branch: request.branch,
      ...(request.create ? { create: request.create } : {}),
      connectionId: context.connectionId
    })
    return
  }
  await callRuntimeRpc(
    target,
    'git.checkout',
    {
      worktree: toRuntimeWorktreeSelector(context.worktreeId),
      branch: request.branch,
      ...(request.create ? { create: request.create } : {})
    },
    { timeoutMs: 60_000 }
  )
}
