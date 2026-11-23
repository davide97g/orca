import type {
  GitStashList,
  GitStashMutation,
  GitStashMutationResult
} from '../../../../shared/git/stash/git-stash'
import { listStashes, runStashMutation } from '../../../git/source-control/stash/stash'
import {
  localGitOptionsForTarget,
  requireLocalRuntimeGitRoute,
  type RuntimeGitCommandHost
} from './runtime-git-command-target'

/** Source Control stashes; like branch switching, they run on the host that serves the worktree. */
export class RuntimeGitStashCommands {
  constructor(private readonly host: RuntimeGitCommandHost) {}

  async listRuntimeGitStashes(worktreeSelector: string): Promise<GitStashList> {
    const target = await this.host.resolveRuntimeGitTarget(worktreeSelector)
    requireLocalRuntimeGitRoute(target)
    return listStashes(target.worktree.path, {
      ...localGitOptionsForTarget(target),
      admissionTier: 'interactive'
    })
  }

  async runRuntimeGitStashMutation(
    worktreeSelector: string,
    mutation: GitStashMutation
  ): Promise<GitStashMutationResult> {
    const target = await this.host.resolveRuntimeGitTarget(worktreeSelector)
    requireLocalRuntimeGitRoute(target)
    return runStashMutation(target.worktree.path, mutation, {
      ...localGitOptionsForTarget(target),
      admissionTier: 'interactive'
    })
  }
}
