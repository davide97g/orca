import type {
  GitStashList,
  GitStashMutation,
  GitStashMutationResult
} from '../../../../../shared/git/stash/git-stash'
import type { RuntimeGitContext } from './runtime-git-client-context'
import { callRuntimeRpc } from '../../rpc/calls/runtime-rpc-call'
import { toRuntimeWorktreeSelector } from '../../rpc/targets/runtime-worktree-selector'

export function listRuntimeGitStashes(context: RuntimeGitContext): Promise<GitStashList> {
  return callRuntimeRpc<GitStashList>(
    context.target,
    'git.stashList',
    { worktree: toRuntimeWorktreeSelector(context.worktreeId ?? '') },
    { timeoutMs: 15_000 }
  )
}

export function runRuntimeGitStashMutation(
  context: RuntimeGitContext,
  mutation: GitStashMutation
): Promise<GitStashMutationResult> {
  return callRuntimeRpc<GitStashMutationResult>(
    context.target,
    'git.stash',
    { worktree: toRuntimeWorktreeSelector(context.worktreeId ?? ''), mutation },
    { timeoutMs: 60_000 }
  )
}
