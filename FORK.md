# Orca fork: branch switcher

Personal fork of [stablyai/orca](https://github.com/stablyai/orca) that adds a VS Code-style
branch switcher to the Source Control panel: click the branch name in the header to switch to a
local branch, check out a remote branch as a tracking branch, or type a new name to create one.

Everything lives on the `branch-switcher` branch, as a few commits on top of an official release:

| Commit | Purpose | Upstreamable |
| --- | --- | --- |
| `feat(source-control): VS Code-style branch switcher` | The feature | Yes |
| `chore(local): violet-to-lime gradient border app icon` | Tells this build apart from official Orca | No |
| `chore(local): build computer-use helper with the native Swift build system` | Swift 6.4+ build fix | No |
| `docs: fork maintenance guide` | This file | No |

The tag `fork-base` marks the release commit those commits sit on. `main` mirrors upstream and is
never changed.

## Remotes

```sh
git remote -v
# origin    https://github.com/davide97g/orca.git   (this fork)
# upstream  https://github.com/stablyai/orca.git    (official Orca)
```

On a fresh clone: `git remote add upstream https://github.com/stablyai/orca.git`, then
`git fetch origin --tags` to get `fork-base`.

## Updating to a new Orca release

Orca ships releases as `vX.Y.Z` tags, often daily. Upgrade when you want a fix, not on every
release.

### 1. Move the fork onto the new release

```sh
NEW=v1.4.216                                        # pick from: gh release list -R stablyai/orca -L 5
git fetch --depth=1 upstream tag "$NEW" --no-tags   # works in a shallow clone
git switch branch-switcher
git rebase --onto "$NEW" fork-base branch-switcher  # replays only the fork's commits
```

`--onto … fork-base` replays exactly the fork's commits, even in a shallow clone where git cannot
find the merge base itself.

If the rebase stops on a conflict:

- `src/renderer/src/i18n/locales/en.json`: take upstream's file, then regenerate the fork's keys.
  During a rebase `--ours` is the new upstream base:
  `git checkout --ours src/renderer/src/i18n/locales/en.json && pnpm run sync:localization-catalog`.
- Anything under `src/`: upstream refactored code the switcher touches. Keep upstream's shape and
  re-apply the fork change. The feature is small: grep for `branchSwitch`, `GitBranchCheckout` and
  `git:checkout`.
- `resources/build/icon.*`: keep the fork's version.

Then `git add … && git rebase --continue`.

### 2. Verify

```sh
export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"   # repo requires Node 24
pnpm install --frozen-lockfile
(cd mobile && pnpm install --frozen-lockfile)               # needed by the mobile web bundle
pnpm tc
pnpm test src/shared/git-branch-checkout.test.ts \
  src/renderer/src/components/right-sidebar/source-control \
  src/renderer/src/runtime src/renderer/src/web \
  src/relay/git-handler.test.ts src/main/runtime/rpc/methods/git.test.ts
pnpm run check:code-quality:changed
```

`pnpm install` can rewrite `pnpm-lock.yaml` (it adds `@pnpm/exe`). Don't commit that:
`git checkout pnpm-lock.yaml`.

### 3. Build the app (macOS arm64)

```sh
pnpm run build:desktop
pnpm run build:computer-macos
pnpm run build:keyboard-layout-macos
pnpm run build:notification-status-macos
pnpm run ensure:electron-runtime
ORCA_BUILD_COMMIT=$(git rev-parse --short=12 HEAD) \
ORCA_LOCAL_BUILD_VERSION="${NEW#v}-local.$(date +%s).branchswitch" \
  pnpm exec electron-builder --config config/electron-builder.config.cjs --mac dir --arm64
```

The output is `dist/mac-arm64/Orca.app`. It is signed with a Developer ID found in the keychain,
and not notarized.

- A full build takes a while. After a change that only touches `src/`, rerunning
  `pnpm run build:electron-vite` and then the `electron-builder` command is enough.
- On Swift older than 6.2, `--build-system native` doesn't exist: remove those two arguments
  from `config/scripts/build-computer-macos.mjs` before building.

### 4. Install

1. Quit Orca.
2. Once only: System Settings → Privacy & Security → App Management → allow your terminal app,
   otherwise macOS blocks changes to `/Applications` even with `sudo`.
3. Replace the app. Use `ditto`, because `cp -R` can break the framework symlinks and invalidate
   the signature:

```sh
rm -rf /Applications/Orca.app
ditto dist/mac-arm64/Orca.app /Applications/Orca.app
killall Dock          # refresh the icon cache
open /Applications/Orca.app
```

### 5. Publish

```sh
git tag -f fork-base "$NEW"
git push --force-with-lease origin branch-switcher
git push -f origin fork-base
```

## Things to know

- **Auto-update overwrites the fork.** Local builds report `X.Y.Z-local…`, so Orca's updater
  offers the official release and installing it removes the switcher. Decline it and rebuild from
  this guide instead.
- **Don't downgrade.** After running a newer official Orca, only install a fork build based on
  the same release or newer, so Orca's saved state never meets an older schema. Check
  `stateSchemaVersion` and `daemonProtocolVersion` in
  `Contents/Resources/orca-local-build.json` of both apps.
- **Upstreaming.** To offer the feature to stablyai/orca, cherry-pick only the `feat(...)` commit
  onto upstream `main` in a new branch and open a PR. Related: issue #16362 and the older PR #5416.
