import React, { useCallback, useMemo } from 'react'
import { GitBranch, Loader2 } from 'lucide-react'
import {
  SourceControlBranchSwitcher,
  type SourceControlBranchSwitchTarget
} from '@/components/right-sidebar/source-control/panel/branch-switcher'
import {
  BRANCH_SYNC_BUTTON_CLASS,
  BranchSyncButton
} from '@/components/right-sidebar/source-control/panel/branch-sync-button'
import { resolveBranchSyncIndicator } from '@/components/right-sidebar/source-control/panel/branch-sync-indicator-model'
import { translate } from '@/i18n/i18n'
import { getConnectionId } from '@/lib/connection-context'
import { getRepoOwnerRoutedSettings } from '@/lib/repo-runtime-owner'
import { getWorktreeGitIdentityDisplay } from '@/lib/worktree-git-identity-display'
import { useAppStore } from '@/store'
import { useActiveWorktree, useRepoById } from '@/store/selectors'
import { isGitRepoKind } from '../../../../shared/repo-kind'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from './status-bar-context-menu-policy'

/** VS Code-style footer: current branch (opens the branch switcher) + ahead/behind sync button. */
export function BranchSyncStatusSegment({
  iconOnly
}: {
  iconOnly: boolean
}): React.JSX.Element | null {
  const worktree = useActiveWorktree()
  const worktreeId = worktree?.id ?? null
  const repo = useRepoById(worktree?.repoId ?? null)
  const settings = useAppStore((s) => s.settings)
  const isDirty = useAppStore((s) =>
    worktreeId ? (s.gitStatusByWorktree[worktreeId]?.length ?? 0) > 0 : false
  )
  const remoteStatus = useAppStore((s) =>
    worktreeId ? s.remoteStatusesByWorktree[worktreeId] : undefined
  )
  const conflictOperation = useAppStore((s) =>
    worktreeId ? (s.gitConflictOperationByWorktree[worktreeId] ?? 'unknown') : 'unknown'
  )
  const isRemoteOperationActive = useAppStore((s) => s.isRemoteOperationActive)
  const syncBranch = useAppStore((s) => s.syncBranch)
  const pushBranch = useAppStore((s) => s.pushBranch)
  const fetchUpstreamStatus = useAppStore((s) => s.fetchUpstreamStatus)

  const repoId = repo?.id ?? null
  const repoConnectionId = repo?.connectionId ?? null
  const repoExecutionHostId = repo?.executionHostId ?? null
  // Why: git ops must run on the repo's owner host (SSH/runtime), not the focused sidebar host.
  const ownerSettings = useMemo(
    () =>
      getRepoOwnerRoutedSettings(
        settings,
        repoId
          ? { id: repoId, connectionId: repoConnectionId, executionHostId: repoExecutionHostId }
          : null
      ),
    [repoConnectionId, repoExecutionHostId, repoId, settings]
  )
  const worktreePath = worktree?.path ?? null
  const pushTarget = worktree?.pushTarget
  const connectionId = worktreeId
    ? (getConnectionId(worktreeId) ?? repoConnectionId ?? undefined)
    : undefined

  const refreshUpstream = useCallback(() => {
    if (worktreeId && worktreePath) {
      void fetchUpstreamStatus(worktreeId, worktreePath, connectionId, pushTarget, {
        runtimeTargetSettings: ownerSettings
      })
    }
  }, [connectionId, fetchUpstreamStatus, ownerSettings, pushTarget, worktreeId, worktreePath])

  const branchSwitchTarget = useMemo<SourceControlBranchSwitchTarget | null>(() => {
    if (!repoId || !worktreeId || !worktreePath) {
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
      repoId,
      worktreeId,
      worktreePath,
      ...(connectionId ? { connectionId } : {}),
      settings: ownerSettings,
      disabledReason,
      // Why: HEAD changes reach git status via the worktree watcher; upstream needs an explicit refresh.
      onSwitched: refreshUpstream
    }
  }, [
    conflictOperation,
    connectionId,
    isRemoteOperationActive,
    ownerSettings,
    refreshUpstream,
    repoId,
    worktreeId,
    worktreePath
  ])

  const indicator = resolveBranchSyncIndicator(remoteStatus)

  const runSync = useCallback(async (): Promise<void> => {
    if (!worktreeId || !worktreePath || isRemoteOperationActive) {
      return
    }
    const options = { runtimeTargetSettings: ownerSettings }
    try {
      // Why: matches VS Code — sync = fetch + pull, then push local commits (lease-forced for rebased branches).
      await (indicator.kind === 'publish'
        ? pushBranch(worktreeId, worktreePath, true, connectionId, pushTarget, options)
        : syncBranch(worktreeId, worktreePath, connectionId, pushTarget, options))
    } catch {
      // Store remote actions already surface the failure toast.
    }
  }, [
    connectionId,
    indicator.kind,
    isRemoteOperationActive,
    ownerSettings,
    pushBranch,
    pushTarget,
    syncBranch,
    worktreeId,
    worktreePath
  ])

  if (!worktree || !repo || !isGitRepoKind(repo) || !branchSwitchTarget) {
    return null
  }
  const display = getWorktreeGitIdentityDisplay(worktree)
  if (!display) {
    return null
  }
  const dirtyMarker = isDirty ? '*' : ''

  return (
    <div className="flex min-w-0 items-center gap-0.5" {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}>
      {display.kind === 'branch' ? (
        <SourceControlBranchSwitcher
          branchName={display.branchName}
          target={branchSwitchTarget}
          side="top"
          renderTrigger={({ label, pending, disabled }) => (
            <button
              type="button"
              className={BRANCH_SYNC_BUTTON_CLASS}
              aria-label={translate(
                'auto.components.right.sidebar.SourceControl.a4e93c21d7',
                'Current branch: {{value0}}',
                { value0: label }
              )}
              aria-disabled={disabled || undefined}
              data-testid="status-bar-branch"
            >
              {pending ? (
                <Loader2 className="size-3 shrink-0 animate-spin" />
              ) : (
                <GitBranch className="size-3 shrink-0" />
              )}
              {!iconOnly ? (
                <span className="max-w-48 truncate font-mono text-[11px] font-medium">
                  {label}
                  {dirtyMarker}
                </span>
              ) : null}
            </button>
          )}
        />
      ) : (
        <span className="inline-flex min-w-0 items-center gap-1 px-1 py-0.5 text-muted-foreground">
          <GitBranch className="size-3 shrink-0" />
          {!iconOnly ? (
            <span className="max-w-48 truncate font-mono text-[11px] font-medium">
              {display.sourceControlLabel}
              {dirtyMarker}
            </span>
          ) : null}
        </span>
      )}
      {display.kind === 'branch' && indicator.kind !== 'unknown' ? (
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
