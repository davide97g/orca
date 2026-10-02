import type { GitAdmissionTier } from './command-runner/git-exec-options'

export type GitRuntimeOptions = {
  wslDistro?: string
  signal?: AbortSignal
  admissionTier?: GitAdmissionTier
}

export function gitOptionsForWorktree(
  cwd: string,
  options: GitRuntimeOptions = {}
): { cwd: string; wslDistro?: string; signal?: AbortSignal; admissionTier?: GitAdmissionTier } {
  return {
    cwd,
    ...(options.wslDistro ? { wslDistro: options.wslDistro } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.admissionTier ? { admissionTier: options.admissionTier } : {})
  }
}

/**
 * Options for a git invocation that only reads. Opting in explicitly keeps the
 * shell-free WSL route from depending on `wsl-direct-git-read-commands`
 * classifying the argv, which is a heuristic these call sites already know the
 * answer to.
 */
export function gitReadOptionsForWorktree(
  cwd: string,
  options: GitRuntimeOptions = {}
): {
  cwd: string
  wslDistro?: string
  signal?: AbortSignal
  admissionTier?: GitAdmissionTier
  preferWslDirectGit: true
} {
  return { ...gitOptionsForWorktree(cwd, options), preferWslDirectGit: true }
}

/**
 * Options for a git invocation that talks to a remote. Without the opt-in, the
 * BatchMode `GIT_SSH_COMMAND` guard overrides the repo's `core.sshCommand`, so a
 * per-repo SSH key (e.g. via `includeIf`) is dropped and auth uses the wrong account.
 */
export function gitNetworkOptionsForWorktree(
  cwd: string,
  options: GitRuntimeOptions = {}
): {
  cwd: string
  wslDistro?: string
  signal?: AbortSignal
  admissionTier?: GitAdmissionTier
  useConfiguredSshCommandForNetwork: true
} {
  return { ...gitOptionsForWorktree(cwd, options), useConfiguredSshCommandForNetwork: true }
}
