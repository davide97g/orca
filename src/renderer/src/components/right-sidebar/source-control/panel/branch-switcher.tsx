import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Cloud, GitBranch, GitBranchPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { branchDisplayName } from '@/components/sidebar/WorktreeCardHelpers'
import { translate } from '@/i18n/i18n'
import { extractIpcErrorMessage } from '@/lib/ipc-error'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { cn } from '@/lib/utils'
import type { RuntimeGitSettings } from '@/runtime/runtime-git-client-context'
import { checkoutRuntimeGitBranch, listRuntimeGitLocalBranches } from '@/runtime/runtime-git-client'
import { searchRuntimeRepoBaseRefDetails } from '@/runtime/runtime-repo-client'
import { useAppStore } from '@/store'
import type { GitBranchCheckoutRequest } from '../../../../../../shared/git-branch-checkout'
import type { BaseRefSearchResult } from '../../../../../../shared/repo-types'
import type { RuntimeGitLocalBranches } from '../../../../../../shared/runtime-types'
import type { Worktree } from '../../../../../../shared/worktree/types'
import type { BranchSyncControl } from './branch-sync-button'
import {
  buildBranchSwitchCandidates,
  type BranchSwitchSiblingWorktree
} from './branch-switch-candidates'

const REMOTE_REF_SEARCH_LIMIT = 50
const REMOTE_REF_SEARCH_DEBOUNCE_MS = 150
const EMPTY_WORKTREES: Worktree[] = []

export type SourceControlBranchSwitchTarget = {
  repoId: string
  worktreeId: string
  worktreePath: string
  connectionId?: string
  /** Repo-owner-routed settings: the switch must run on the host that owns the worktree. */
  settings: RuntimeGitSettings | null | undefined
  /** Non-null while switching would be unsafe (merge/rebase in progress, remote op running). */
  disabledReason: string | null
  onSwitched: () => void
  /** Ahead/behind sync control rendered beside the picker; null until upstream status resolves. */
  sync?: BranchSyncControl | null
}

type BranchSwitchListProps = {
  target: SourceControlBranchSwitchTarget
  currentBranch: string
  onRequest: (request: GitBranchCheckoutRequest) => void
  onJumpToWorktree: (worktreeId: string) => void
  onClose: () => void
}

function useSiblingWorktrees(repoId: string, worktreeId: string): BranchSwitchSiblingWorktree[] {
  const worktrees = useAppStore((s) => s.worktreesByRepo[repoId] ?? EMPTY_WORKTREES)
  return useMemo(
    () =>
      worktrees
        .filter((worktree) => worktree.id !== worktreeId && !worktree.isArchived)
        .map((worktree) => ({
          id: worktree.id,
          displayName: worktree.displayName,
          branch: branchDisplayName(worktree.branch ?? '')
        })),
    [worktreeId, worktrees]
  )
}

function BranchSwitchList({
  target,
  currentBranch,
  onRequest,
  onJumpToWorktree,
  onClose
}: BranchSwitchListProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [local, setLocal] = useState<RuntimeGitLocalBranches | null>(null)
  const [remoteRefs, setRemoteRefs] = useState<BaseRefSearchResult[]>([])
  const siblingWorktrees = useSiblingWorktrees(target.repoId, target.worktreeId)
  const { settings, worktreeId, worktreePath, connectionId, repoId } = target

  useEffect(() => {
    let stale = false
    listRuntimeGitLocalBranches({ settings, worktreeId, worktreePath, connectionId })
      .then((result) => {
        if (!stale) {
          setLocal(result)
        }
      })
      .catch((error: unknown) => {
        if (!stale) {
          setLocal({ current: currentBranch, branches: [currentBranch] })
          console.warn('[SourceControl] listing local branches failed', error)
        }
      })
    return () => {
      stale = true
    }
  }, [connectionId, currentBranch, settings, worktreeId, worktreePath])

  useEffect(() => {
    let stale = false
    const timer = window.setTimeout(() => {
      searchRuntimeRepoBaseRefDetails(settings, repoId, query, REMOTE_REF_SEARCH_LIMIT)
        .then((refs) => {
          if (!stale) {
            setRemoteRefs(refs)
          }
        })
        .catch(() => {
          if (!stale) {
            setRemoteRefs([])
          }
        })
    }, REMOTE_REF_SEARCH_DEBOUNCE_MS)
    return () => {
      stale = true
      window.clearTimeout(timer)
    }
  }, [query, repoId, settings])

  const candidates = useMemo(
    () =>
      buildBranchSwitchCandidates({
        localBranches: local?.branches ?? [],
        currentBranch: local?.current ?? currentBranch,
        remoteRefs,
        siblingWorktrees,
        query
      }),
    [currentBranch, local, query, remoteRefs, siblingWorktrees]
  )

  return (
    <Command shouldFilter={false} className="min-h-0">
      <CommandInput
        value={query}
        onValueChange={setQuery}
        wrapperClassName="shrink-0"
        placeholder={translate(
          'sourceControl.branchSwitcher.placeholder',
          'Select a branch or type a new name'
        )}
      />
      <CommandList className="max-h-80 min-h-0 flex-1">
        {candidates.createName ? (
          <CommandGroup>
            <CommandItem
              value="create"
              onSelect={() => onRequest({ branch: candidates.createName ?? '', create: {} })}
            >
              <GitBranchPlus className="size-3.5" />
              <span className="min-w-0 truncate">
                {translate(
                  'sourceControl.branchSwitcher.create',
                  'Create branch "{{name}}" from {{base}}',
                  { name: candidates.createName, base: currentBranch }
                )}
              </span>
            </CommandItem>
          </CommandGroup>
        ) : null}
        <CommandGroup heading={translate('sourceControl.branchSwitcher.localHeading', 'Branches')}>
          {local === null ? (
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              {translate('sourceControl.branchSwitcher.loading', 'Loading branches…')}
            </div>
          ) : null}
          {candidates.local.map((entry) => (
            <CommandItem
              key={`local:${entry.branch}`}
              value={`local:${entry.branch}`}
              onSelect={() => {
                if (entry.isCurrent) {
                  onClose()
                } else if (entry.checkedOutIn) {
                  onJumpToWorktree(entry.checkedOutIn.worktreeId)
                } else {
                  onRequest({ branch: entry.branch })
                }
              }}
            >
              {entry.isCurrent ? (
                <Check className="size-3.5" />
              ) : (
                <GitBranch className="size-3.5 opacity-60" />
              )}
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{entry.branch}</span>
              {entry.checkedOutIn ? (
                <span className="max-w-[45%] shrink-0 truncate text-[11px] text-muted-foreground">
                  {translate('sourceControl.branchSwitcher.checkedOutIn', 'in {{name}}', {
                    name: entry.checkedOutIn.displayName
                  })}
                </span>
              ) : null}
            </CommandItem>
          ))}
        </CommandGroup>
        {candidates.remote.length > 0 ? (
          <CommandGroup
            heading={translate('sourceControl.branchSwitcher.remoteHeading', 'Remote branches')}
          >
            {candidates.remote.map((entry) => (
              <CommandItem
                key={`remote:${entry.refName}`}
                value={`remote:${entry.refName}`}
                onSelect={() =>
                  onRequest({
                    branch: entry.localBranchName,
                    create: { startPoint: entry.refName, track: true }
                  })
                }
              >
                <Cloud className="size-3.5 opacity-60" />
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{entry.refName}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {local !== null &&
        candidates.local.length === 0 &&
        candidates.remote.length === 0 &&
        !candidates.createName ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            {translate('sourceControl.branchSwitcher.noMatches', 'No matching branches.')}
          </div>
        ) : null}
      </CommandList>
    </Command>
  )
}

function describeCheckoutRequest(request: GitBranchCheckoutRequest): string {
  return request.create
    ? translate('sourceControl.branchSwitcher.createFailed', 'Could not create branch {{name}}', {
        name: request.branch
      })
    : translate('sourceControl.branchSwitcher.switchFailed', 'Could not switch to {{name}}', {
        name: request.branch
      })
}

export type BranchSwitcherTriggerState = {
  label: string
  pending: boolean
  disabled: boolean
}

/** VS Code-style branch picker behind the Source Control header's branch name. */
export function SourceControlBranchSwitcher({
  branchName,
  target,
  side = 'bottom',
  renderTrigger
}: {
  branchName: string
  target: SourceControlBranchSwitchTarget
  side?: 'top' | 'bottom'
  /** Must render a single focusable element; it becomes the popover + tooltip trigger. */
  renderTrigger?: (state: BranchSwitcherTriggerState) => React.ReactElement
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [pendingBranch, setPendingBranch] = useState<string | null>(null)
  const disabled = target.disabledReason !== null || pendingBranch !== null

  const runCheckout = useCallback(
    async (request: GitBranchCheckoutRequest): Promise<void> => {
      setOpen(false)
      setPendingBranch(request.branch)
      try {
        await checkoutRuntimeGitBranch(
          {
            settings: target.settings,
            worktreeId: target.worktreeId,
            worktreePath: target.worktreePath,
            connectionId: target.connectionId
          },
          request
        )
      } catch (error) {
        toast.error(describeCheckoutRequest(request), {
          description: extractIpcErrorMessage(error, request.branch)
        })
      } finally {
        setPendingBranch(null)
        // Why: refresh even on failure; a refused checkout can still have created the branch.
        target.onSwitched()
      }
    },
    [target]
  )

  const tooltip =
    target.disabledReason ??
    translate('sourceControl.branchSwitcher.tooltip', 'Switch branch ({{name}})', {
      name: branchName
    })

  return (
    <Popover open={open} onOpenChange={(next) => setOpen(next && !disabled)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            {renderTrigger ? (
              renderTrigger({
                label: pendingBranch ?? branchName,
                pending: pendingBranch !== null,
                disabled
              })
            ) : (
              <button
                type="button"
                className={cn(
                  'flex min-w-0 max-w-full items-center gap-1 rounded-sm border-0 bg-transparent p-0 text-left font-mono text-[10.5px] font-medium text-foreground/90 outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring',
                  disabled && 'cursor-default'
                )}
                aria-label={translate(
                  'auto.components.right.sidebar.SourceControl.a4e93c21d7',
                  'Current branch: {{value0}}',
                  { value0: branchName }
                )}
                aria-disabled={disabled || undefined}
                data-testid="source-control-head-identity"
              >
                <span className="min-w-0 truncate">{pendingBranch ?? branchName}</span>
                {pendingBranch ? (
                  <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                )}
              </button>
            )}
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side={side} sideOffset={6} className="max-w-72 break-all">
          {tooltip}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        side={side}
        align="start"
        className="flex w-80 max-w-[calc(100vw-2rem)] flex-col"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          const content = event.currentTarget
          if (content instanceof HTMLElement) {
            content.querySelector<HTMLInputElement>('[data-slot="command-input"]')?.focus()
          }
        }}
      >
        <BranchSwitchList
          target={target}
          currentBranch={branchName}
          onRequest={(request) => void runCheckout(request)}
          onJumpToWorktree={(worktreeId) => {
            setOpen(false)
            activateAndRevealWorktree(worktreeId, { sidebarRevealBehavior: 'auto' })
          }}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  )
}
