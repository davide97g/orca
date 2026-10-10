import React from 'react'
import { Archive, ArchiveRestore, CopyPlus, FileCheck, FilePlus2, Trash } from 'lucide-react'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import type { GitStashPushMode } from '../../../../../../shared/git-stash'
import { stashPushModeLabel } from './stash-dialogs'
import type { SourceControlStashes } from './use-stashes'

const PUSH_MODES: { mode: GitStashPushMode; icon: React.ComponentType<{ className?: string }> }[] =
  [
    { mode: 'tracked', icon: Archive },
    { mode: 'include-untracked', icon: FilePlus2 },
    { mode: 'staged', icon: FileCheck }
  ]

/** "Stash" submenu for the Source Control overflow menu, mirroring VS Code's stash commands. */
export function SourceControlStashMenu({
  stashes
}: {
  stashes: SourceControlStashes
}): React.JSX.Element {
  const disabled = stashes.busy || stashes.disabledReason !== null
  const latest = stashes.entries[0]
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Archive className="size-3.5" />
        {translate('sourceControl.stash.menu', 'Stash')}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-[200px]">
        {PUSH_MODES.map(({ mode, icon: Icon }) => (
          <DropdownMenuItem
            key={mode}
            disabled={disabled}
            onSelect={() => stashes.requestPush(mode)}
          >
            <Icon className="size-3.5" />
            {stashPushModeLabel(mode)}…
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={disabled || !latest}
          onSelect={() => latest && stashes.runEntryAction('apply', latest)}
        >
          <CopyPlus className="size-3.5" />
          {translate('sourceControl.stash.applyLatest', 'Apply Latest Stash')}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={disabled || !latest}
          onSelect={() => latest && stashes.runEntryAction('pop', latest)}
        >
          <ArchiveRestore className="size-3.5" />
          {translate('sourceControl.stash.popLatest', 'Pop Latest Stash')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={disabled || !latest}
          onSelect={() => stashes.requestDrop({ kind: 'all' })}
        >
          <Trash className="size-3.5" />
          {translate('sourceControl.stash.clear', 'Drop All Stashes')}…
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
