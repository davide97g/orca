import { defineMethod } from '../../../core'
import {
  GitStash,
  GitSwitchBranch,
  WorktreeSelector
} from '../../../../../../shared/rpc-contract/source-control/git-params'

export const GIT_BRANCH_METHODS = [
  defineMethod({
    name: 'git.switchBranch',
    permission: 'workspace',
    params: GitSwitchBranch,
    handler: async (params, { runtime }) =>
      runtime.switchRuntimeGitBranch(params.worktree, params.target)
  }),
  defineMethod({
    name: 'git.stashList',
    permission: 'workspace',
    params: WorktreeSelector,
    handler: async (params, { runtime }) => runtime.listRuntimeGitStashes(params.worktree)
  }),
  defineMethod({
    name: 'git.stash',
    permission: 'workspace',
    params: GitStash,
    handler: async (params, { runtime }) =>
      runtime.runRuntimeGitStashMutation(params.worktree, params.mutation)
  })
]
