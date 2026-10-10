import { ipcMain } from 'electron'
import {
  parseGitStashMutation,
  type GitStashList,
  type GitStashMutationResult
} from '../../../shared/git-stash'
import { listStashes, runStashMutation } from '../../git/stash'
import {
  getSshGitProvider,
  SSH_GIT_PROVIDER_UNAVAILABLE_MESSAGE
} from '../../providers/ssh-git-dispatch'
import { resolveRegisteredWorktreePath } from '../registered-worktree-roots-cache'
import { getLocalGitOptionsForRegisteredWorktree } from '../local-worktree-runtime-options'
import type { FilesystemHandlerContext } from './filesystem-handler-context'

/** Source Control stashes: list, create, apply/pop/drop and clear. */
export function registerFilesystemGitStashHandlers(context: FilesystemHandlerContext): void {
  const { store } = context

  ipcMain.handle(
    'git:stashList',
    async (
      _event,
      args: { worktreePath: string; connectionId?: string }
    ): Promise<GitStashList> => {
      if (args.connectionId) {
        const provider = getSshGitProvider(args.connectionId)
        if (!provider) {
          throw new Error(SSH_GIT_PROVIDER_UNAVAILABLE_MESSAGE)
        }
        return provider.listStashes(args.worktreePath)
      }
      const worktreePath = await resolveRegisteredWorktreePath(args.worktreePath, store)
      const gitOptions = getLocalGitOptionsForRegisteredWorktree(
        store,
        args.worktreePath,
        worktreePath
      )
      return listStashes(worktreePath, { ...gitOptions, admissionTier: 'interactive' })
    }
  )

  ipcMain.handle(
    'git:stash',
    async (
      _event,
      args: { worktreePath: string; mutation: unknown; connectionId?: string }
    ): Promise<GitStashMutationResult> => {
      const mutation = parseGitStashMutation(args.mutation)
      if (args.connectionId) {
        const provider = getSshGitProvider(args.connectionId)
        if (!provider) {
          throw new Error(SSH_GIT_PROVIDER_UNAVAILABLE_MESSAGE)
        }
        return provider.runStashMutation(args.worktreePath, mutation)
      }
      const worktreePath = await resolveRegisteredWorktreePath(args.worktreePath, store)
      const gitOptions = getLocalGitOptionsForRegisteredWorktree(
        store,
        args.worktreePath,
        worktreePath
      )
      return runStashMutation(worktreePath, mutation, {
        ...gitOptions,
        admissionTier: 'interactive'
      })
    }
  )
}
