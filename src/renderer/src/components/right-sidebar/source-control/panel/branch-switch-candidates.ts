import type { BaseRefSearchResult } from '../../../../../../shared/repo-types'

export type BranchSwitchWorktreeRef = {
  worktreeId: string
  displayName: string
}

export type BranchSwitchLocalCandidate = {
  branch: string
  isCurrent: boolean
  /** Another workspace already has this branch checked out, so git would refuse the switch. */
  checkedOutIn: BranchSwitchWorktreeRef | null
}

export type BranchSwitchRemoteCandidate = {
  refName: string
  localBranchName: string
}

export type BranchSwitchCandidates = {
  local: BranchSwitchLocalCandidate[]
  remote: BranchSwitchRemoteCandidate[]
  /** Trimmed query when it names no local branch, i.e. it can be offered as a new branch. */
  createName: string | null
}

export type BranchSwitchSiblingWorktree = {
  id: string
  displayName: string
  /** Short branch name (no `refs/heads/`); empty for detached or folder workspaces. */
  branch: string
}

function matchesQuery(value: string, normalizedQuery: string): boolean {
  return normalizedQuery.length === 0 || value.toLowerCase().includes(normalizedQuery)
}

export function buildBranchSwitchCandidates({
  localBranches,
  currentBranch,
  remoteRefs,
  siblingWorktrees,
  query
}: {
  localBranches: readonly string[]
  currentBranch: string | null
  remoteRefs: readonly BaseRefSearchResult[]
  siblingWorktrees: readonly BranchSwitchSiblingWorktree[]
  query: string
}): BranchSwitchCandidates {
  const trimmedQuery = query.trim()
  const normalizedQuery = trimmedQuery.toLowerCase()
  const localSet = new Set(localBranches)
  const checkedOutByBranch = new Map<string, BranchSwitchWorktreeRef>()
  for (const sibling of siblingWorktrees) {
    if (sibling.branch && !checkedOutByBranch.has(sibling.branch)) {
      checkedOutByBranch.set(sibling.branch, {
        worktreeId: sibling.id,
        displayName: sibling.displayName
      })
    }
  }

  const local = localBranches
    .filter((branch) => matchesQuery(branch, normalizedQuery))
    .map((branch) => ({
      branch,
      isCurrent: branch === currentBranch,
      checkedOutIn: branch === currentBranch ? null : (checkedOutByBranch.get(branch) ?? null)
    }))

  const seenRemote = new Set<string>()
  const remote: BranchSwitchRemoteCandidate[] = []
  for (const ref of remoteRefs) {
    // Why: ref search mixes heads and remotes; a head's short name equals its local name.
    const isRemoteRef = ref.refName !== ref.localBranchName
    if (
      !isRemoteRef ||
      localSet.has(ref.refName) ||
      localSet.has(ref.localBranchName) ||
      seenRemote.has(ref.refName) ||
      !matchesQuery(ref.refName, normalizedQuery)
    ) {
      continue
    }
    seenRemote.add(ref.refName)
    remote.push({ refName: ref.refName, localBranchName: ref.localBranchName })
  }

  const createName =
    trimmedQuery.length > 0 && !trimmedQuery.startsWith('-') && !localSet.has(trimmedQuery)
      ? trimmedQuery
      : null

  return { local, remote, createName }
}
