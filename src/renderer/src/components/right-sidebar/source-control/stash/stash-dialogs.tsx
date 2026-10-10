import React, { useRef, useState } from 'react'
import { Archive, Trash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import type { GitStashPushMode } from '../../../../../../shared/git-stash'
import { focusDiscardDialogConfirmButton } from '../commit/discard-dialog'
import { stashEntryLabel, type SourceControlStashes } from './use-stashes'

export function stashPushModeLabel(mode: GitStashPushMode): string {
  switch (mode) {
    case 'tracked':
      return translate('sourceControl.stash.push', 'Stash')
    case 'include-untracked':
      return translate('sourceControl.stash.pushIncludeUntracked', 'Stash (Include Untracked)')
    case 'staged':
      return translate('sourceControl.stash.pushStaged', 'Stash Staged')
  }
}

function StashPushForm({
  mode,
  onConfirm,
  onCancel
}: {
  mode: GitStashPushMode
  onConfirm: (message: string) => void
  onCancel: () => void
}): React.JSX.Element {
  const [message, setMessage] = useState('')
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        onConfirm(message)
      }}
    >
      <DialogHeader>
        <DialogTitle>{stashPushModeLabel(mode)}</DialogTitle>
        <DialogDescription>
          {translate(
            'sourceControl.stash.messageDescription',
            'Optionally describe the stash. Leave empty to use the default message.'
          )}
        </DialogDescription>
      </DialogHeader>
      <Input
        autoFocus
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder={translate('sourceControl.stash.messagePlaceholder', 'Stash message')}
        aria-label={translate('sourceControl.stash.messagePlaceholder', 'Stash message')}
      />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {translate('sourceControl.stash.cancel', 'Cancel')}
        </Button>
        <Button type="submit">
          <Archive className="size-4" />
          {translate('sourceControl.stash.push', 'Stash')}
        </Button>
      </DialogFooter>
    </form>
  )
}

function StashDropDialog({ stashes }: { stashes: SourceControlStashes }): React.JSX.Element {
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const { pendingDrop } = stashes
  const title =
    pendingDrop?.kind === 'all'
      ? translate('sourceControl.stash.clearConfirmTitle', 'Drop all {{count}} stashes?', {
          count: stashes.entries.length
        })
      : translate('sourceControl.stash.dropConfirmTitle', 'Drop this stash?')
  return (
    <Dialog
      open={pendingDrop !== null}
      onOpenChange={(open) => {
        if (!open) {
          stashes.cancelDrop()
        }
      }}
    >
      <DialogContent
        className="max-w-md"
        onOpenAutoFocus={(event) =>
          focusDiscardDialogConfirmButton(event, confirmButtonRef.current)
        }
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {translate('sourceControl.stash.dropConfirmDescription', 'This cannot be undone.')}
          </DialogDescription>
        </DialogHeader>
        {pendingDrop?.kind === 'entry' ? (
          <div className="rounded-md border border-border/70 bg-muted/35 px-3 py-2 text-xs">
            <div className="break-all font-medium text-foreground">
              {stashEntryLabel(pendingDrop.entry)}
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={stashes.cancelDrop}>
            {translate('sourceControl.stash.cancel', 'Cancel')}
          </Button>
          <Button
            ref={confirmButtonRef}
            type="button"
            variant="destructive"
            onClick={stashes.confirmDrop}
          >
            <Trash className="size-4" />
            {pendingDrop?.kind === 'all'
              ? translate('sourceControl.stash.clear', 'Drop All Stashes')
              : translate('sourceControl.stash.drop', 'Drop Stash')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Stash message prompt and drop confirmation; rendered outside the scrolling panel surface. */
export function SourceControlStashDialogs({
  stashes
}: {
  stashes: SourceControlStashes
}): React.JSX.Element {
  const { pendingPushMode } = stashes
  return (
    <>
      <Dialog
        open={pendingPushMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            stashes.cancelPush()
          }
        }}
      >
        <DialogContent className="max-w-md">
          {pendingPushMode ? (
            <StashPushForm
              mode={pendingPushMode}
              onConfirm={stashes.confirmPush}
              onCancel={stashes.cancelPush}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <StashDropDialog stashes={stashes} />
    </>
  )
}
