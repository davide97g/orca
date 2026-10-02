import React from 'react'
import { CloudUpload, RefreshCw } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { BranchSyncIndicator } from './branch-sync-indicator-model'

export const BRANCH_SYNC_BUTTON_CLASS =
  'inline-flex min-w-0 cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent'

export type KnownBranchSyncIndicator = Exclude<BranchSyncIndicator, { kind: 'unknown' }>

/** Sync (or publish) control beside the branch picker, shared by Source Control and the status bar. */
export type BranchSyncControl = {
  indicator: KnownBranchSyncIndicator
  busy: boolean
  onRun: () => void
}

function describeSyncTooltip(indicator: Extract<BranchSyncIndicator, { kind: 'sync' }>): string {
  if (indicator.forcePushWithLease) {
    return translate(
      'sourceControl.branchSync.forcePushTooltip',
      'Remote only has older copies of local commits. Click to force push with lease.'
    )
  }
  const upstream =
    indicator.upstreamName ?? translate('sourceControl.branchSync.upstreamFallback', 'upstream')
  if (indicator.ahead === 0 && indicator.behind === 0) {
    return translate(
      'sourceControl.branchSync.upToDate',
      'Up to date with {{upstream}}. Click to sync.',
      { upstream }
    )
  }
  return translate(
    'sourceControl.branchSync.syncTooltip',
    'Sync with {{upstream}}: {{behind}} to pull, {{ahead}} to push',
    { upstream, behind: indicator.behind, ahead: indicator.ahead }
  )
}

export function BranchSyncButton({
  control,
  tooltipSide,
  testId
}: {
  control: BranchSyncControl
  tooltipSide: 'top' | 'bottom'
  testId: string
}): React.JSX.Element {
  const { indicator, busy, onRun } = control
  const isPublish = indicator.kind === 'publish'
  const tooltip = isPublish
    ? translate('sourceControl.branchSync.publishTooltip', 'Publish branch')
    : describeSyncTooltip(indicator)
  const showCounts = !isPublish && (indicator.ahead > 0 || indicator.behind > 0)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={BRANCH_SYNC_BUTTON_CLASS}
          onClick={onRun}
          disabled={busy}
          aria-label={tooltip}
          aria-busy={busy || undefined}
          data-testid={testId}
        >
          {isPublish ? (
            <CloudUpload className="size-3 shrink-0" />
          ) : (
            <RefreshCw className={busy ? 'size-3 shrink-0 animate-spin' : 'size-3 shrink-0'} />
          )}
          {showCounts ? (
            <span className="text-[11px] font-medium tabular-nums">
              {indicator.behind}↓ {indicator.ahead}↑
            </span>
          ) : null}
        </button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide} sideOffset={6}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}
