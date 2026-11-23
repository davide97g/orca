import {
  listGitStashes,
  runGitStashMutation,
  type GitStashList,
  type GitStashMutation,
  type GitStashMutationResult
} from '../../../../shared/git/stash/git-stash'
import { gitExecFileAsync } from '../../command-runner/git-exec-file'
import {
  gitOptionsForWorktree,
  type GitRuntimeOptions
} from '../../command-runner/git-runtime-options'
import { runWithGitReadCacheInvalidation } from '../git-read-cache-invalidation'

export async function listStashes(
  worktreePath: string,
  options: GitRuntimeOptions = {}
): Promise<GitStashList> {
  return listGitStashes((argv) =>
    gitExecFileAsync(argv, gitOptionsForWorktree(worktreePath, options))
  )
}

export async function runStashMutation(
  worktreePath: string,
  mutation: GitStashMutation,
  options: GitRuntimeOptions = {}
): Promise<GitStashMutationResult> {
  return runWithGitReadCacheInvalidation(() =>
    runGitStashMutation(
      (argv) => gitExecFileAsync(argv, gitOptionsForWorktree(worktreePath, options)),
      mutation
    )
  )
}
