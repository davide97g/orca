# Forca: Orca fork with Source Control extras

Personal fork of [stablyai/orca](https://github.com/stablyai/orca) that adds Source Control
features on top of an official release:

- **Branch sync indicator** in Source Control and the status bar (#1). Shows ahead/behind
  against the upstream; clicking syncs (or publishes a branch with no upstream). The status bar
  branch name opens Orca's branch picker.
- **Stashes.** A Stash submenu in the Source Control `…` menu (stash, include untracked, staged
  only, apply/pop latest, drop all) and a Stashes section listing each stash with apply, pop, drop
  and click-to-view. When only uncommitted changes block a branch switch, the branch picker
  offers **Stash & Switch**: picking an existing branch stashes the changes first.

Everything lives on `main`, as a few commits on top of an official release:

| Commit                                                      | Purpose                                   | Upstreamable |
| ----------------------------------------------------------- | ----------------------------------------- | ------------ |
| `chore(local): violet-to-lime gradient border app icon`     | Tells this build apart from official Orca | No           |
| `docs: fork maintenance guide`                              | This file                                 | No           |
| `docs: rename fork to Forca in README`                      | README banner                             | No           |
| `feat(source-control): VS Code-style branch sync indicator` | Sync indicator (#1)                       | Yes          |
| `feat(source-control): VS Code-style stashes`               | Stash menu, section and Stash & Switch    | Yes          |

Features that upstream now ships, so the fork dropped them in the move to v1.4.271:

- Branch switcher: Orca's own picker (`source-control/branches/`).
- `core.sshCommand` for fetch/pull/push: upstream's network SSH policy.
- Claude `system:init` frame shown as an error: upstream marks it as status chrome.
- `--build-system native` for Swift 6.4: upstream's `build-computer-macos.mjs` handles it.

The tag `fork-base` marks the release commit those commits sit on. `main` is the only branch.
Open pull requests against `main`.

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
NEW=v1.4.271                                        # pick from: gh release list -R stablyai/orca -L 5
git fetch --depth=1 upstream tag "$NEW" --no-tags   # works in a shallow clone
git switch main
git rebase --onto "$NEW" fork-base main             # replays only the fork's commits
```

`--onto … fork-base` replays exactly the fork's commits, even in a shallow clone where git cannot
find the merge base itself. The rebase drops the PR merge commits and keeps the commits they
merged, so `main` stays a straight line.

If the rebase stops on a conflict:

- `src/renderer/src/i18n/locales/en.json`: take upstream's file, then regenerate the fork's keys.
  During a rebase `--ours` is the new upstream base:
  `git checkout --ours src/renderer/src/i18n/locales/en.json && pnpm run sync:localization-catalog`.
- Anything under `src/`: upstream refactored code the fork touches. Keep upstream's shape and
  re-apply the fork change. The changes are small: grep for `BranchSync`, `git.stash`,
  `GitStash`, `stashFirst` and `useSourceControlStashes`.
- `src/shared/rpc-contract/rpc-params-catalog.generated.ts`: take upstream's file, then
  `pnpm run generate:rpc-params-catalog`.
- `resources/build/icon.*`: keep the fork's version.

Then `git add … && git rebase --continue`.

### 2. Verify

```sh
export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"   # repo requires Node 24
pnpm install --frozen-lockfile
(cd mobile && pnpm install --frozen-lockfile)               # needed by the mobile web bundle
pnpm tc
pnpm test src/shared/git/stash src/main/git/source-control/stash \
  src/renderer/src/components/right-sidebar/source-control \
  src/renderer/src/components/status-bar \
  src/main/runtime/integrations/git src/main/runtime/rpc/methods
ORCA_CODE_QUALITY_BASE="$NEW" pnpm run check:code-quality:changed  # origin/main predates the rebase
```

`pnpm install` can rewrite `pnpm-lock.yaml` (it adds `@pnpm/exe`). Don't commit that:
`git checkout pnpm-lock.yaml`. Builds leave generated files under `mobile/src/`; remove them
before the code-quality check or it lints them.

If upstream refactors too much for a rebase (v1.4.224 to v1.4.271 moved most of `src/`), branch
from the new tag instead, cherry-pick the icon and docs commits, and port each feature by hand.
Check first which features upstream now ships.

### 3. Build the app (macOS arm64)

Build the app code and native helpers:

```sh
pnpm run build:desktop
pnpm run build:computer-macos
pnpm run build:keyboard-layout-macos
pnpm run build:process-footprint-macos
pnpm run build:notification-status-macos
pnpm run ensure:electron-runtime
```

After a change that only touches `src/`, `pnpm run build:electron-vite` replaces this whole step.

Then package the app in one of two ways.

#### Quick local build (not notarized)

For trying a change on this machine only:

```sh
ORCA_BUILD_COMMIT=$(git rev-parse --short=12 HEAD) \
ORCA_LOCAL_BUILD_VERSION="${NEW#v}-local.$(date +%s).branchswitch" \
  pnpm exec electron-builder --config config/electron-builder.config.cjs --mac dir --arm64
```

The output is `dist/mac-arm64/Orca.app`, signed with the Developer ID in the keychain. It has no
hardened runtime, so Apple can't notarize it. Don't publish it.

#### Notarized release build

Use this for anything you publish. It needs the notarization credentials in the keychain. Store
them once (it prompts for an app-specific password from appleid.apple.com):

```sh
xcrun notarytool store-credentials orca-notary --apple-id <apple-id-email> --team-id DA596D32QB
```

Release mode (`ORCA_MAC_RELEASE=1`) turns on hardened runtime and notarization but ignores
`ORCA_LOCAL_BUILD_VERSION`. A small wrapper config sets the version back:

```sh
VERSION="${NEW#v}-local.$(date +%s).branchswitch"
cat > /tmp/eb-release.config.cjs <<EOF
const base = require('$PWD/config/electron-builder.config.cjs')
module.exports = { ...base, extraMetadata: { ...(base.extraMetadata || {}), version: '$VERSION' } }
EOF

ORCA_MAC_RELEASE=1 APPLE_KEYCHAIN_PROFILE=orca-notary ORCA_MAC_TEAM_ID=DA596D32QB \
ORCA_BUILD_COMMIT=$(git rev-parse --short=12 HEAD) \
  pnpm exec electron-builder --config /tmp/eb-release.config.cjs --mac dir --arm64 --publish never
xcrun stapler validate dist/mac-arm64/Orca.app
```

This signs `dist/mac-arm64/Orca.app`, sends it to Apple, and staples the ticket. Apple's reply
takes about 5 to 15 minutes.

- If stapling fails with `NOT_FOUND` right after `notarization successful`, the ticket hasn't
  propagated yet. Wait a minute and run `xcrun stapler staple dist/mac-arm64/Orca.app`.
- Build `dir` only. The config's DMG and ZIP targets also build x64, which fails here because the
  x64 native modules aren't installed.

Package the stapled app as a DMG and a ZIP. The DMG needs its own signature and notarization:

```sh
cat > /tmp/eb-package.config.cjs <<'EOF'
const base = require('/tmp/eb-release.config.cjs')
module.exports = {
  ...base,
  mac: { ...base.mac, notarize: false, target: [{ target: 'dmg', arch: ['arm64'] }] },
  dmg: { ...base.dmg, artifactName: 'Orca-${version}-arm64.${ext}' }
}
EOF

ORCA_MAC_RELEASE=1 ORCA_MAC_TEAM_ID=DA596D32QB pnpm exec electron-builder --config /tmp/eb-package.config.cjs \
  --mac --arm64 --prepackaged dist/mac-arm64/Orca.app --publish never
DMG="dist/Orca-$VERSION-arm64.dmg"
codesign --force --sign "Developer ID Application: Davide Ghiotto (DA596D32QB)" --timestamp "$DMG"
xcrun notarytool submit "$DMG" --keychain-profile orca-notary --wait
xcrun stapler staple "$DMG"
ditto -c -k --sequesterRsrc --keepParent dist/mac-arm64/Orca.app "dist/Orca-$VERSION-arm64-mac.zip"
```

Check both with Gatekeeper. Each should print `source=Notarized Developer ID`:

```sh
spctl -a -vv dist/mac-arm64/Orca.app
spctl -a -vv -t open --context context:primary-signature "$DMG"
```

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

Push the rebased branch and move the base tag:

```sh
git tag -f fork-base "$NEW"
git push --force-with-lease origin main
git push -f origin fork-base
```

Then attach the notarized DMG and ZIP to a GitHub release. Name the tag after the base release,
and bump the last number for each new build on the same base:

```sh
TAG="${NEW}-branchswitch.1"
shasum -a 256 dist/Orca-$VERSION-arm64.dmg dist/Orca-$VERSION-arm64-mac.zip
gh release create "$TAG" -R davide97g/orca --target "$(git rev-parse HEAD)" \
  --title "Orca ${NEW#v} + branch switcher (macOS arm64)" --notes-file notes.md \
  "dist/Orca-$VERSION-arm64.dmg" "dist/Orca-$VERSION-arm64-mac.zip"
```

`--target` needs the full commit SHA. A short SHA fails with `target_commitish is invalid`. Put
the feature list, install steps and checksums in `notes.md`. See
[v1.4.211-branchswitch.1](https://github.com/davide97g/orca/releases/tag/v1.4.211-branchswitch.1)
for an example.

## Things to know

- **Auto-update overwrites the fork.** Fork builds report `X.Y.Z-local…`, so Orca's updater
  offers the official release, and installing it removes the fork's features. Decline it and
  rebuild from this guide instead.
- **Don't downgrade.** After running a newer official Orca, only install a fork build based on
  the same release or newer, so Orca's saved state never meets an older schema. Check
  `stateSchemaVersion` and `daemonProtocolVersion` in
  `Contents/Resources/orca-local-build.json` of both apps.
- **Upstreaming.** To offer a feature to stablyai/orca, cherry-pick only its `feat(...)` or
  `fix(...)` commit onto `upstream/main` in a new branch and open a PR from there. Related: issue
  #16362 and the older PR #5416.
