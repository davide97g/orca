import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { listStashes, runStashMutation } from './stash'

describe('stash real Git contract', () => {
  const tempPaths: string[] = []

  afterEach(() => {
    for (const path of tempPaths.splice(0)) {
      rmSync(path, { recursive: true, force: true })
    }
  })

  function createRepo(): { repoPath: string; git: (...args: string[]) => string } {
    const repoPath = mkdtempSync(join(tmpdir(), 'orca-stash-'))
    tempPaths.push(repoPath)
    const git = (...args: string[]): string =>
      execFileSync('git', args, { cwd: repoPath, encoding: 'utf8' })
    git('init', '--quiet', '-b', 'main')
    git('config', 'user.name', 'Orca Test')
    git('config', 'user.email', 'orca@example.test')
    git('config', 'commit.gpgSign', 'false')
    git('config', 'core.hooksPath', '.git/no-hooks')
    writeFileSync(join(repoPath, 'tracked.txt'), 'base\n')
    git('add', 'tracked.txt')
    git('commit', '--quiet', '-m', 'base')
    return { repoPath, git }
  }

  it('stashes, lists, applies, pops, drops and clears', async () => {
    const { repoPath, git } = createRepo()
    const trackedPath = join(repoPath, 'tracked.txt')
    const untrackedPath = join(repoPath, 'new.txt')

    await expect(runStashMutation(repoPath, { kind: 'push', mode: 'tracked' })).resolves.toEqual({
      ok: true,
      changed: false
    })

    writeFileSync(trackedPath, 'first\n')
    await runStashMutation(repoPath, { kind: 'push', mode: 'tracked', message: 'first change' })
    writeFileSync(trackedPath, 'second\n')
    writeFileSync(untrackedPath, 'untracked\n')
    await runStashMutation(repoPath, { kind: 'push', mode: 'include-untracked' })
    expect(readFileSync(trackedPath, 'utf8')).toBe('base\n')
    expect(existsSync(untrackedPath)).toBe(false)

    const { entries } = await listStashes(repoPath)
    expect(entries.map(({ index, branch }) => ({ index, branch }))).toEqual([
      { index: 0, branch: 'main' },
      { index: 1, branch: 'main' }
    ])
    expect(entries[1]?.message).toBe('first change')
    expect(entries[0]?.oid).toBe(git('rev-parse', 'stash@{0}').trim())

    const [latest, older] = entries
    if (!latest || !older) {
      throw new Error('expected two stashes')
    }
    await runStashMutation(repoPath, { kind: 'pop', index: latest.index, oid: latest.oid })
    expect(readFileSync(trackedPath, 'utf8')).toBe('second\n')
    expect(existsSync(untrackedPath)).toBe(true)
    // The pop shifted `older` to index 0, so its stale index is refused.
    await expect(
      runStashMutation(repoPath, { kind: 'drop', index: older.index, oid: older.oid })
    ).rejects.toThrow('The stash list changed')

    git('checkout', '--', 'tracked.txt')
    rmSync(untrackedPath)
    await runStashMutation(repoPath, { kind: 'apply', index: 0, oid: older.oid })
    expect(readFileSync(trackedPath, 'utf8')).toBe('first\n')
    expect((await listStashes(repoPath)).entries).toHaveLength(1)

    await runStashMutation(repoPath, { kind: 'drop', index: 0, oid: older.oid })
    expect((await listStashes(repoPath)).entries).toEqual([])

    await runStashMutation(repoPath, { kind: 'push', mode: 'tracked' })
    await runStashMutation(repoPath, { kind: 'clear' })
    expect((await listStashes(repoPath)).entries).toEqual([])
  })

  it('stashes only staged changes', async () => {
    const { repoPath, git } = createRepo()
    writeFileSync(join(repoPath, 'tracked.txt'), 'staged\n')
    git('add', 'tracked.txt')
    writeFileSync(join(repoPath, 'other.txt'), 'untracked\n')
    await runStashMutation(repoPath, { kind: 'push', mode: 'staged' })
    expect(readFileSync(join(repoPath, 'tracked.txt'), 'utf8')).toBe('base\n')
    expect(existsSync(join(repoPath, 'other.txt'))).toBe(true)
  })
})
