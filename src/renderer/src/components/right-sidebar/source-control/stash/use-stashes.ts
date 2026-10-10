import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { extractIpcErrorMessage } from '@/lib/ipc-error'
import {
  getRuntimeGitCommitCompare,
  listRuntimeGitStashes,
  runRuntimeGitStashMutation,
  type RuntimeGitContext
} from '@/runtime/runtime-git-client'
import { useAppStore } from '@/store'
import type {
  GitStashEntry,
  GitStashEntryAction,
  GitStashMutation,
  GitStashPushMode
} from '../../../../../../shared/git-stash'
import type { SourceControlPanelModel } from '../panel/use-panel-model'
import { refreshSourceControlAfterRemoteAction } from '../sync/remote-refresh'

export type PendingStashDrop = { kind: 'entry'; entry: GitStashEntry } | { kind: 'all' }

export type SourceControlStashes = {
  entries: GitStashEntry[]
  /** True while a stash command runs; every stash action is disabled meanwhile. */
  busy: boolean
  /** Non-null while stashing would be unsafe (merge/rebase in progress, remote op running). */
  disabledReason: string | null
  refresh: () => void
  requestPush: (mode: GitStashPushMode) => void
  runEntryAction: (action: Exclude<GitStashEntryAction, 'drop'>, entry: GitStashEntry) => void
  requestDrop: (drop: PendingStashDrop) => void
  view: (entry: GitStashEntry) => void
  pendingPushMode: GitStashPushMode | null
  confirmPush: (message: string) => void
  cancelPush: () => void
  pendingDrop: PendingStashDrop | null
  confirmDrop: () => void
  cancelDrop: () => void
}

const EMPTY_ENTRIES: GitStashEntry[] = []

export function stashEntryLabel(entry: GitStashEntry): string {
  return entry.message || `stash@{${entry.index}}`
}

function describeStashFailure(mutation: GitStashMutation): string {
  switch (mutation.kind) {
    case 'push':
      return translate('sourceControl.stash.pushFailed', 'Could not stash changes')
    case 'apply':
      return translate('sourceControl.stash.applyFailed', 'Could not apply stash')
    case 'pop':
      return translate('sourceControl.stash.popFailed', 'Could not pop stash')
    case 'drop':
      return translate('sourceControl.stash.dropFailed', 'Could not drop stash')
    case 'clear':
      return translate('sourceControl.stash.clearFailed', 'Could not drop stashes')
  }
}

function describeStashSuccess(mutation: GitStashMutation, changed: boolean): string {
  switch (mutation.kind) {
    case 'push':
      return changed
        ? translate('sourceControl.stash.pushed', 'Changes stashed')
        : translate('sourceControl.stash.nothingToStash', 'No local changes to stash')
    case 'apply':
      return translate('sourceControl.stash.applied', 'Stash applied')
    case 'pop':
      return translate('sourceControl.stash.popped', 'Stash popped')
    case 'drop':
      return translate('sourceControl.stash.dropped', 'Stash dropped')
    case 'clear':
      return translate('sourceControl.stash.cleared', 'All stashes dropped')
  }
}

function resolveStashErrorMessage(error: unknown): string {
  const message = extractIpcErrorMessage(error, 'git stash failed')
  // Why: `--staged` landed in git 2.35; older hosts reject it as an unknown option.
  return /unknown option .?staged/.test(message)
    ? translate('sourceControl.stash.stagedUnsupported', 'Stash Staged needs Git 2.35 or newer.')
    : message
}

/** Stash list + actions for the focused git worktree; null for folder workspaces. */
export function useSourceControlStashes(
  model: SourceControlPanelModel,
  worktreePath: string | null
): SourceControlStashes | null {
  const {
    activeConnectionId,
    activeRepoSettings,
    activeWorktreeId,
    conflictOperation,
    entries: statusEntries,
    isFolder,
    isRemoteOperationActive,
    refreshActiveGitStatusAfterMutation,
    refreshBranchCompare,
    refreshGitHistory
  } = model
  const openCommitAllDiffs = useAppStore((s) => s.openCommitAllDiffs)
  const [stashes, setStashes] = useState<{ key: string; entries: GitStashEntry[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [pendingPushMode, setPendingPushMode] = useState<GitStashPushMode | null>(null)
  const [pendingDrop, setPendingDrop] = useState<PendingStashDrop | null>(null)
  const requestSeqRef = useRef(0)

  const enabled = Boolean(activeWorktreeId && worktreePath && !isFolder)
  const contextKey = `${activeWorktreeId ?? ''}\0${worktreePath ?? ''}`
  const context = useMemo<RuntimeGitContext | null>(
    () =>
      activeWorktreeId && worktreePath
        ? {
            settings: activeRepoSettings,
            worktreeId: activeWorktreeId,
            worktreePath,
            connectionId: activeConnectionId ?? undefined
          }
        : null,
    [activeConnectionId, activeRepoSettings, activeWorktreeId, worktreePath]
  )

  const refresh = useCallback(() => {
    if (!enabled || !context) {
      return
    }
    const seq = ++requestSeqRef.current
    listRuntimeGitStashes(context)
      .then((result) => {
        if (seq === requestSeqRef.current) {
          setStashes({ key: contextKey, entries: result.entries })
        }
      })
      .catch((error: unknown) => {
        if (seq === requestSeqRef.current) {
          setStashes({ key: contextKey, entries: EMPTY_ENTRIES })
        }
        console.warn('[SourceControl] listing stashes failed', error)
      })
  }, [context, contextKey, enabled])

  // Why: status entries keep their identity until the working tree changes, so this also
  // catches `git stash` / `git stash pop` run from a terminal.
  useEffect(() => {
    refresh()
  }, [refresh, statusEntries])

  const runMutation = useCallback(
    async (mutation: GitStashMutation): Promise<void> => {
      if (!context) {
        return
      }
      setBusy(true)
      try {
        const result = await runRuntimeGitStashMutation(context, mutation)
        toast.success(describeStashSuccess(mutation, result.changed))
      } catch (error) {
        toast.error(describeStashFailure(mutation), {
          description: resolveStashErrorMessage(error)
        })
      } finally {
        setBusy(false)
        refresh()
        // Why: refresh even on failure; a conflicting apply/pop still writes files and conflict state.
        refreshSourceControlAfterRemoteAction({
          refreshGitStatus: refreshActiveGitStatusAfterMutation,
          refreshBranchCompare,
          refreshGitHistory
        })
      }
    },
    [context, refresh, refreshActiveGitStatusAfterMutation, refreshBranchCompare, refreshGitHistory]
  )

  const view = useCallback(
    (entry: GitStashEntry) => {
      if (!context || !activeWorktreeId || !worktreePath) {
        return
      }
      const subject = `stash@{${entry.index}}: ${stashEntryLabel(entry)}`
      getRuntimeGitCommitCompare(context, entry.oid)
        .then((result) => {
          if (result.summary.status !== 'ready') {
            throw new Error(result.summary.errorMessage ?? 'Failed to load stash diff')
          }
          openCommitAllDiffs(
            activeWorktreeId,
            worktreePath,
            result.summary,
            result.entries,
            subject,
            subject
          )
        })
        .catch((error: unknown) => {
          toast.error(translate('sourceControl.stash.viewFailed', 'Could not open stash'), {
            description: extractIpcErrorMessage(error, 'Failed to load stash diff')
          })
        })
    },
    [activeWorktreeId, context, openCommitAllDiffs, worktreePath]
  )

  const disabledReason =
    conflictOperation === 'merge' || conflictOperation === 'rebase'
      ? translate(
          'sourceControl.stash.disabledConflict',
          'Finish or abort the {{operation}} before using stashes',
          { operation: conflictOperation }
        )
      : isRemoteOperationActive
        ? translate(
            'sourceControl.branchSwitcher.disabledRemote',
            'Wait for the running git operation to finish'
          )
        : null

  if (!enabled) {
    return null
  }
  return {
    // Why: drop the previous worktree's list until this worktree's first listing lands.
    entries: stashes?.key === contextKey ? stashes.entries : EMPTY_ENTRIES,
    busy,
    disabledReason,
    refresh,
    requestPush: setPendingPushMode,
    runEntryAction: (action, entry) =>
      void runMutation({ kind: action, index: entry.index, oid: entry.oid }),
    requestDrop: setPendingDrop,
    view,
    pendingPushMode,
    confirmPush: (message) => {
      const mode = pendingPushMode
      setPendingPushMode(null)
      if (mode) {
        void runMutation({ kind: 'push', mode, ...(message.trim() ? { message } : {}) })
      }
    },
    cancelPush: () => setPendingPushMode(null),
    pendingDrop,
    confirmDrop: () => {
      const drop = pendingDrop
      setPendingDrop(null)
      if (drop?.kind === 'entry') {
        void runMutation({ kind: 'drop', index: drop.entry.index, oid: drop.entry.oid })
      } else if (drop?.kind === 'all') {
        void runMutation({ kind: 'clear' })
      }
    },
    cancelDrop: () => setPendingDrop(null)
  }
}
