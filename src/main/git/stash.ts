import {
  listGitStashes,
  runGitStashMutation,
  type GitStashList,
  type GitStashMutation,
  type GitStashMutationResult
} from '../../shared/git-stash'
import type { GitRuntimeOptions } from './git-runtime-options'
import { gitOptionsForWorktree } from './git-runtime-options'
import { gitExecFileAsync } from './runner'
import { runWithGitReadCacheInvalidation } from './status'

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
