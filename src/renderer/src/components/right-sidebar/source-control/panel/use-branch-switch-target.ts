import { useMemo } from 'react'
import { translate } from '@/i18n/i18n'
import { refreshSourceControlAfterRemoteAction } from '../sync/remote-refresh'
import type { SourceControlBranchSwitchTarget } from './branch-switcher'
import { resolveBranchSyncIndicator } from './branch-sync-indicator-model'
import type { SourceControlPanelModel } from './use-panel-model'

/** Null for folder workspaces or when no git worktree is focused, so the header keeps its plain label. */
export function useSourceControlBranchSwitchTarget(
  model: SourceControlPanelModel,
  worktreePath: string | null
): SourceControlBranchSwitchTarget | null {
  const {
    activeConnectionId,
    activeRepo,
    activeRepoSettings,
    activeWorktreeId,
    conflictOperation,
    isFolder,
    isRemoteOperationActive,
    refreshActiveGitStatusAfterMutation,
    refreshBranchCompare,
    refreshGitHistory,
    remoteStatus,
    runRemoteAction
  } = model

  return useMemo(() => {
    const indicator = resolveBranchSyncIndicator(remoteStatus)
    if (!activeRepo || !activeWorktreeId || !worktreePath || isFolder) {
      return null
    }
    const disabledReason =
      conflictOperation === 'merge' || conflictOperation === 'rebase'
        ? translate(
            'sourceControl.branchSwitcher.disabledConflict',
            'Finish or abort the {{operation}} before switching branches',
            { operation: conflictOperation }
          )
        : isRemoteOperationActive
          ? translate(
              'sourceControl.branchSwitcher.disabledRemote',
              'Wait for the running git operation to finish'
            )
          : null
    return {
      repoId: activeRepo.id,
      worktreeId: activeWorktreeId,
      worktreePath,
      ...(activeConnectionId ? { connectionId: activeConnectionId } : {}),
      settings: activeRepoSettings,
      disabledReason,
      onSwitched: () =>
        refreshSourceControlAfterRemoteAction({
          refreshGitStatus: refreshActiveGitStatusAfterMutation,
          refreshBranchCompare,
          refreshGitHistory
        }),
      sync:
        indicator.kind === 'unknown'
          ? null
          : {
              indicator,
              busy: isRemoteOperationActive,
              // Why: runner owns inline error state + post-op refresh; sync handles lease force-push itself.
              onRun: () => void runRemoteAction(indicator.kind === 'publish' ? 'publish' : 'sync')
            }
    }
  }, [
    activeConnectionId,
    activeRepo,
    activeRepoSettings,
    activeWorktreeId,
    conflictOperation,
    isFolder,
    isRemoteOperationActive,
    refreshActiveGitStatusAfterMutation,
    refreshBranchCompare,
    refreshGitHistory,
    remoteStatus,
    runRemoteAction,
    worktreePath
  ])
}
