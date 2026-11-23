import React, { useCallback } from 'react'
import { GitBranch } from 'lucide-react'
import { WorkspaceBranchPicker } from '@/components/right-sidebar/source-control/branches/WorkspaceBranchPicker'
import { recordWorktreeBranchSwitchLanded } from '@/components/right-sidebar/source-control/branches/workspace-branch-switch-status'
import {
  BRANCH_SYNC_BUTTON_CLASS,
  BranchSyncButton
} from '@/components/right-sidebar/source-control/panel/branch-sync-button'
import { resolveBranchSyncIndicator } from '@/components/right-sidebar/source-control/panel/branch-sync-indicator-model'
import { useWorktreeGitOwnerTarget } from '@/components/right-sidebar/source-control/sync/worktree-git-owner-target'
import { useTranslate } from '@/i18n/use-translate'
import { getConnectionId } from '@/lib/workspace/ownership/connection-context'
import { useAppStore } from '@/store/index'
import { useRepoById } from '@/store/repos/use-repository-catalog'
import { useActiveWorktree } from '@/store/workspaces/selection/use-selected-worktree'
import { isGitRepoKind } from '../../../../shared/repository/repo-kind'
import { getWorktreeGitIdentityDisplay } from '../../../../shared/worktree/row-display/git-identity-display'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from './composition/status-bar-context-menu-policy'

/** VS Code-style footer: current branch (opens the branch picker) + ahead/behind sync button. */
export function BranchSyncStatusSegment(): React.JSX.Element | null {
  const t = useTranslate()
  const worktree = useActiveWorktree()
  const worktreeId = worktree?.id ?? null
  const hostId = worktree?.hostId ?? 'local'
  const repo = useRepoById(worktree?.repoId ?? null)
  const target = useWorktreeGitOwnerTarget(worktreeId, hostId)
  const isDirty = useAppStore((s) =>
    worktreeId ? (s.gitStatusByWorktree[worktreeId]?.length ?? 0) > 0 : false
  )
  const remoteStatus = useAppStore((s) =>
    worktreeId ? s.remoteStatusesByWorktree[worktreeId] : undefined
  )
  const isRemoteOperationActive = useAppStore((s) => s.isRemoteOperationActive)
  const syncBranch = useAppStore((s) => s.syncBranch)
  const pushBranch = useAppStore((s) => s.pushBranch)

  const worktreePath = worktree?.path ?? null
  const pushTarget = worktree?.pushTarget
  const indicator = resolveBranchSyncIndicator(remoteStatus)

  const onLanded = useCallback(() => {
    if (worktreeId && worktreePath) {
      recordWorktreeBranchSwitchLanded(worktreeId, hostId, worktreePath)
    }
  }, [hostId, worktreeId, worktreePath])

  const runSync = useCallback(async (): Promise<void> => {
    if (!worktreeId || !worktreePath || !target || isRemoteOperationActive) {
      return
    }
    const connectionId = getConnectionId(worktreeId) ?? undefined
    const options = { runtimeTarget: target }
    try {
      // Why: matches VS Code. Sync = fetch + pull, then push local commits; rebased branches push with lease.
      if (indicator.kind === 'publish') {
        await pushBranch(worktreeId, worktreePath, true, connectionId, pushTarget, options)
      } else if (indicator.kind === 'sync' && indicator.forcePushWithLease) {
        await pushBranch(worktreeId, worktreePath, false, connectionId, pushTarget, {
          ...options,
          forceWithLease: true
        })
      } else {
        await syncBranch(worktreeId, worktreePath, connectionId, pushTarget, options)
      }
    } catch {
      // Store remote actions already surface the failure toast.
    }
  }, [
    indicator,
    isRemoteOperationActive,
    pushBranch,
    pushTarget,
    syncBranch,
    target,
    worktreeId,
    worktreePath
  ])

  if (!worktree || !worktreeId || !worktreePath || !repo || !isGitRepoKind(repo)) {
    return null
  }
  const display = getWorktreeGitIdentityDisplay(worktree)
  if (!display) {
    return null
  }
  const dirtyMarker = isDirty ? '*' : ''
  const label = display.kind === 'branch' ? display.branchName : display.sourceControlLabel
  const labelNode = (
    <>
      <GitBranch className="size-3 shrink-0" />
      <span className="max-w-48 truncate font-mono text-[11px] font-medium">
        {label}
        {dirtyMarker}
      </span>
    </>
  )

  return (
    <div className="flex min-w-0 items-center gap-0.5" {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}>
      {display.kind === 'branch' && target ? (
        <WorkspaceBranchPicker
          worktreeId={worktreeId}
          worktreePath={worktreePath}
          hostId={hostId}
          repoId={repo.id}
          target={target}
          branch={display.branchName}
          refreshOnOpen
          onLanded={onLanded}
          trigger={
            <button
              type="button"
              className={BRANCH_SYNC_BUTTON_CLASS}
              aria-label={t('sourceControl.branchPicker.switch', 'Switch branch: {{branch}}', {
                branch: display.branchName
              })}
              data-testid="status-bar-branch"
            >
              {labelNode}
            </button>
          }
        />
      ) : (
        <span className="inline-flex min-w-0 items-center gap-1 px-1 py-0.5 text-muted-foreground">
          {labelNode}
        </span>
      )}
      {display.kind === 'branch' && target && indicator.kind !== 'unknown' ? (
        <BranchSyncButton
          control={{
            indicator,
            busy: isRemoteOperationActive,
            onRun: () => void runSync()
          }}
          tooltipSide="top"
          testId="status-bar-branch-sync"
        />
      ) : null}
    </div>
  )
}
