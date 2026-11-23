import React from 'react'
import { SourceControlBranchPicker } from '../branches/SourceControlBranchPicker'
import { BranchSyncButton } from './branch-sync-button'
import { resolveBranchSyncIndicator } from './branch-sync-indicator-model'
import type { SourceControlPanelModel } from './use-panel-model'

/** Branch picker plus a VS Code-style ahead/behind sync (or publish) button. */
export function SourceControlBranchSyncHeadControl({
  model
}: {
  model: SourceControlPanelModel
}): React.JSX.Element {
  const { isFolder, isRemoteOperationActive, remoteStatus, runRemoteAction } = model
  const indicator = resolveBranchSyncIndicator(remoteStatus)
  const picker = <SourceControlBranchPicker model={model} />
  if (isFolder || indicator.kind === 'unknown') {
    return picker
  }
  const kind =
    indicator.kind === 'publish' ? 'publish' : indicator.forcePushWithLease ? 'force_push' : 'sync'
  return (
    <span className="flex min-w-0 items-center gap-1">
      <span className="flex min-w-0 items-center">{picker}</span>
      <BranchSyncButton
        control={{
          indicator,
          busy: isRemoteOperationActive,
          // Why: the runner owns inline error state and the post-action refresh.
          onRun: () => void runRemoteAction(kind)
        }}
        tooltipSide="bottom"
        testId="source-control-branch-sync"
      />
    </span>
  )
}
