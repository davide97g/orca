import type { GitStashList, GitStashMutation, GitStashMutationResult } from '../../shared/git-stash'
import { listStashes, runStashMutation } from '../git/stash'
import {
  localGitOptionsForTarget,
  requireRuntimeGitProvider,
  type RuntimeGitCommandHost
} from './runtime-git-command-target'

export class RuntimeGitStashCommands {
  constructor(private readonly host: RuntimeGitCommandHost) {}

  async listRuntimeGitStashes(worktreeSelector: string): Promise<GitStashList> {
    const target = await this.host.resolveRuntimeGitTarget(worktreeSelector)
    const provider = requireRuntimeGitProvider(target)
    if (provider) {
      return provider.listStashes(target.worktree.path)
    }
    return listStashes(target.worktree.path, localGitOptionsForTarget(target))
  }

  async runRuntimeGitStashMutation(
    worktreeSelector: string,
    mutation: GitStashMutation
  ): Promise<GitStashMutationResult> {
    const target = await this.host.resolveRuntimeGitTarget(worktreeSelector)
    const provider = requireRuntimeGitProvider(target)
    if (provider) {
      return provider.runStashMutation(target.worktree.path, mutation)
    }
    return runStashMutation(target.worktree.path, mutation, {
      ...localGitOptionsForTarget(target),
      admissionTier: 'interactive'
    })
  }
}
