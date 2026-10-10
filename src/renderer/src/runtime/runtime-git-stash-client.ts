import type {
  GitStashList,
  GitStashMutation,
  GitStashMutationResult
} from '../../../shared/git-stash'
import { resolveLocalWorktreePath, type RuntimeGitContext } from './runtime-git-client-context'
import { callRuntimeRpc, getActiveRuntimeTarget } from './runtime-rpc-client'
import { toRuntimeWorktreeSelector } from './runtime-worktree-selector'

export async function listRuntimeGitStashes(context: RuntimeGitContext): Promise<GitStashList> {
  const target = getActiveRuntimeTarget(context.settings)
  if (target.kind === 'local' || !context.worktreeId) {
    return window.api.git.stashList({
      worktreePath: resolveLocalWorktreePath(context),
      connectionId: context.connectionId
    })
  }
  return callRuntimeRpc<GitStashList>(
    target,
    'git.stashList',
    { worktree: toRuntimeWorktreeSelector(context.worktreeId) },
    { timeoutMs: 15_000 }
  )
}

export async function runRuntimeGitStashMutation(
  context: RuntimeGitContext,
  mutation: GitStashMutation
): Promise<GitStashMutationResult> {
  const target = getActiveRuntimeTarget(context.settings)
  if (target.kind === 'local' || !context.worktreeId) {
    return window.api.git.stash({
      worktreePath: resolveLocalWorktreePath(context),
      mutation,
      connectionId: context.connectionId
    })
  }
  return callRuntimeRpc<GitStashMutationResult>(
    target,
    'git.stash',
    { worktree: toRuntimeWorktreeSelector(context.worktreeId), mutation },
    { timeoutMs: 60_000 }
  )
}
