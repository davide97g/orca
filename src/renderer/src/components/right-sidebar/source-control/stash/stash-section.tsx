import React from 'react'
import { Archive, ArchiveRestore, CopyPlus, RefreshCw, Trash } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { formatGitHistoryTimestamp } from '../sync/git-history-format'
import { ActionButton } from '../listing/action-button'
import { SectionHeader } from '../listing/section-header'
import { SOURCE_CONTROL_ROW_ACTION_OVERLAY_CLASS } from '../listing/row-layout'
import type { GitStashEntry } from '../../../../../../shared/git-stash'
import { stashEntryLabel, type SourceControlStashes } from './use-stashes'

const STASH_SECTION_KEY = 'stashes'

function StashRow({
  entry,
  stashes
}: {
  entry: GitStashEntry
  stashes: SourceControlStashes
}): React.JSX.Element {
  const actionsDisabled = stashes.busy || stashes.disabledReason !== null
  const label = stashEntryLabel(entry)
  const createdAt = formatGitHistoryTimestamp(entry.createdAt * 1000)
  return (
    <div
      className="group relative flex cursor-pointer items-center gap-1.5 py-1 pl-6 pr-3 transition-colors hover:bg-accent/40"
      title={[label, entry.branch, createdAt].filter(Boolean).join('\n')}
      onClick={() => stashes.view(entry)}
    >
      <Archive className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-xs text-foreground">{label}</span>
      {entry.branch ? (
        <span className="max-w-[40%] shrink-0 truncate font-mono text-[11px] text-muted-foreground">
          {entry.branch}
        </span>
      ) : null}
      <div className={SOURCE_CONTROL_ROW_ACTION_OVERLAY_CLASS}>
        <ActionButton
          icon={Trash}
          title={stashes.disabledReason ?? translate('sourceControl.stash.drop', 'Drop Stash')}
          disabled={actionsDisabled}
          onClick={(event) => {
            event.stopPropagation()
            stashes.requestDrop({ kind: 'entry', entry })
          }}
        />
        <ActionButton
          icon={CopyPlus}
          title={stashes.disabledReason ?? translate('sourceControl.stash.apply', 'Apply Stash')}
          disabled={actionsDisabled}
          onClick={(event) => {
            event.stopPropagation()
            stashes.runEntryAction('apply', entry)
          }}
        />
        <ActionButton
          icon={ArchiveRestore}
          title={stashes.disabledReason ?? translate('sourceControl.stash.pop', 'Pop Stash')}
          disabled={actionsDisabled}
          onClick={(event) => {
            event.stopPropagation()
            stashes.runEntryAction('pop', entry)
          }}
        />
      </div>
    </div>
  )
}

/** Collapsible "Stashes" list; hidden while the worktree has no stashes. */
export function SourceControlStashSection({
  stashes,
  collapsedSections,
  toggleSection
}: {
  stashes: SourceControlStashes
  collapsedSections: Set<string>
  toggleSection: (section: string) => void
}): React.JSX.Element | null {
  if (stashes.entries.length === 0) {
    return null
  }
  const isCollapsed = collapsedSections.has(STASH_SECTION_KEY)
  return (
    <div>
      <SectionHeader
        label={translate('sourceControl.stash.sectionTitle', 'Stashes')}
        count={stashes.entries.length}
        isCollapsed={isCollapsed}
        onToggle={() => toggleSection(STASH_SECTION_KEY)}
        actions={
          <ActionButton
            icon={RefreshCw}
            title={translate('sourceControl.stash.refresh', 'Refresh stashes')}
            onClick={() => stashes.refresh()}
          />
        }
      />
      {isCollapsed
        ? null
        : stashes.entries.map((entry) => (
            <StashRow key={entry.oid} entry={entry} stashes={stashes} />
          ))}
    </div>
  )
}
