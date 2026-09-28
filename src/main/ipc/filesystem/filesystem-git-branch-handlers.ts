import { ipcMain } from 'electron'
import type { GitBranchCheckoutCreate } from '../../../shared/git-branch-checkout'
import type { RuntimeGitLocalBranches } from '../../../shared/runtime-types'
import { checkoutBranch, listLocalBranches } from '../../git/checkout'
import {
  getSshGitProvider,
  SSH_GIT_PROVIDER_UNAVAILABLE_MESSAGE
} from '../../providers/ssh-git-dispatch'
import { resolveRegisteredWorktreePath } from '../registered-worktree-roots-cache'
import { getLocalGitOptionsForRegisteredWorktree } from '../local-worktree-runtime-options'
import type { FilesystemHandlerContext } from './filesystem-handler-context'

/** Source Control branch switcher: list local branches and switch/create in place. */
export function registerFilesystemGitBranchHandlers(context: FilesystemHandlerContext): void {
  const { store } = context

  ipcMain.handle(
    'git:localBranches',
    async (
      _event,
      args: { worktreePath: string; connectionId?: string }
    ): Promise<RuntimeGitLocalBranches> => {
      if (args.connectionId) {
        const provider = getSshGitProvider(args.connectionId)
        if (!provider) {
          throw new Error(SSH_GIT_PROVIDER_UNAVAILABLE_MESSAGE)
        }
        return provider.listLocalBranches(args.worktreePath)
      }
      const worktreePath = await resolveRegisteredWorktreePath(args.worktreePath, store)
      const gitOptions = getLocalGitOptionsForRegisteredWorktree(
        store,
        args.worktreePath,
        worktreePath
      )
      return listLocalBranches(worktreePath, { ...gitOptions, admissionTier: 'interactive' })
    }
  )

  ipcMain.handle(
    'git:checkout',
    async (
      _event,
      args: {
        worktreePath: string
        branch: string
        create?: GitBranchCheckoutCreate
        connectionId?: string
      }
    ): Promise<void> => {
      if (args.connectionId) {
        const provider = getSshGitProvider(args.connectionId)
        if (!provider) {
          throw new Error(SSH_GIT_PROVIDER_UNAVAILABLE_MESSAGE)
        }
        return provider.checkoutBranch(args.worktreePath, args.branch, args.create)
      }
      const worktreePath = await resolveRegisteredWorktreePath(args.worktreePath, store)
      const gitOptions = getLocalGitOptionsForRegisteredWorktree(
        store,
        args.worktreePath,
        worktreePath
      )
      await checkoutBranch(
        worktreePath,
        args.branch,
        { ...gitOptions, admissionTier: 'interactive' },
        args.create
      )
    }
  )
}
