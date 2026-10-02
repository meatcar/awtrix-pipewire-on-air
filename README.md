# awtrix-pipewire-on-air

Monitor your microphone usage and display an "ON AIR" indicator on your Ulanzi TC001.

This tool watches PipeWire for active microphone streams and automatically shows/hides an "ON AIR" message on your [Ulanzi TC001](https://www.ulanzi.com/products/ulanzi-pixel-smart-clock-2882) running [Awtrix](https://awtrix.blueforcer.de/) firmware - perfect for letting others know when you're in a call or recording.

## Features

- **Real-time monitoring** - Uses `pw-dump --monitor` for instant microphone detection
- **Debounced updates** - Prevents flickering from transient audio streams
- **Multiple app support** - Detects microphone usage from any application
- **Clean state management** - Automatically clears the display on startup and shutdown

## Requirements

- [Bun](https://bun.sh) runtime
- PipeWire audio system
- [Ulanzi TC001](https://www.ulanzi.com/products/ulanzi-pixel-smart-clock-2882) running [Awtrix firmware](https://awtrix.blueforcer.de/) on your local network
- `jq` for JSON processing

## Installation

For a source installation, enter the Nix development shell first. It provides the pinned Bun toolchain, `pw-dump`, and `jq`.

```bash
nix develop
bun run check:lockfile
# OR
nix build .
```

## Usage

Set your Ulanzi TC001 host (running Awtrix firmware):

```bash
export AWTRIX_HOST="192.168.1.100"
bun index.ts
# OR
./result/bin/awtrix-pipewire-on-air
```

Or pass it as an argument:

```bash
bun index.ts --awtrix-host 192.168.1.100
```

### Configuration

You can optionally create a configuration file at `$XDG_CONFIG_HOME/awtrix-pipewire-on-air/config.toml` to set default values. Copy `config.example.toml` as a starting point.

The configuration file allows setting:

- `awtrixHost`: Your Ulanzi TC001 IP and port
- `ignoreApps`: List of application names to ignore (won't trigger "ON AIR" indicator)
- `logIgnoredApps`: Whether to log when ignored applications use the mic
- `onAirText`: Text to display when microphone is active
- `onAirIcon`: Icon to display when microphone is active
- `onAirColor`: Text color when microphone is active (hex format)

Settings precedence (highest to lowest):

1. Command-line flags
2. Environment variables
3. Configuration file
4. Default values

## Development

Use the [Nix](https://nixos.org/) development shell so local checks use the same toolchain as CI:

```bash
nix develop
bun run check:lockfile
```

Alternatively, use `direnv allow` to load the shell automatically. Approve the two reviewed cache values interactively first if you want direnv to use that cache; see below. Development tools and formatting live in `nix/flake-modules/`.

The scripts in [package.json](package.json) define the commands. `bun run fmt` formats with Oxfmt and the Nix formatters through treefmt. `bun run check` runs types, Oxlint, frozen lockfile installation, and formatting checks. `bun run test` runs the hardware-free suite; `bun run test:coverage` also writes `coverage/lcov.info`.

```bash
bun run fmt
bun run check
bun run test
nix flake check
```

CI runs the individual checks so failures identify the command responsible. It retains LCOV coverage for 14 days and builds the Nix application and devshell checks. The application check tests the packaged dependency environment independently of the development shell.

Coverage excludes test code and requires 95% line and function coverage, against a measured 100% baseline for the client and monitor. Bun reports only modules instrumented in the test process. The CLI entry point and configuration run in subprocess tests and are not included in these percentages.

### Disposable sandboxes

The [sandbox lifecycle](.agents/README.md) uses shared bootstrap scripts from `nix-templates`. Setup provisions Nix, installs locked Bun dependencies, and runs hardware-free checks. Resume only checks tools and existing dependencies, without reinstalling or rerunning the suite. Project-specific tasks live in `.agents/Taskfile.yml`.

Run these scripts only in disposable Linux environments. Setup disables Nix build sandboxing and writes shell integration in that environment's home directory. Live monitoring still needs a host PipeWire session and an Awtrix device.

### bun2nix cache and packaging

The root flake advertises these cache settings:

- `extra-substituters`: `https://nix-community.cachix.org`
- `extra-trusted-public-keys`: `nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs=`

Review both values, then run this in an interactive terminal:

```bash
nix develop . --command true
```

For each previously unseen setting/value, Nix asks whether to allow it, then whether to remember that decision. Answer `y` only for the reviewed cache values. To let later non-interactive direnv loads reuse the approvals, also answer `y` to `do you want to permanently mark this value as trusted`. Previously saved decisions are reused without prompting.

On Linux, decisions are saved in `$NIX_DATA_HOME/trusted-settings.json` if that variable is set, otherwise `$XDG_DATA_HOME/nix/trusted-settings.json`, defaulting to `~/.local/share/nix/trusted-settings.json`. They are user-wide and keyed by exact setting name and value, not by repository or revision. A changed cache value is not covered by the old approval. This does not edit `nix.conf`.

Ordinary direnv uses `use flake .` without blanket acceptance. It can reuse saved approvals; unapproved cache settings may be ignored during a non-interactive load. Do not add `--accept-flake-config` to `.envrc`: it accepts all root `nixConfig` settings, including future changes. Approving `.envrc` does not hash or approve subsequent `flake.nix` changes, so continue reviewing project code. CI explicitly accepts root flake settings in disposable runners; that policy is not used for normal direnv sessions.

The native converter uses bun2nix's upstream nixpkgs pin to match its cached binary. Its packaging helpers use the project's nixpkgs through the upstream overlay, as do the application, Oxc tooling, and devshell. This keeps the project-selected Bun runtime separate from the converter's build dependencies. Do not make bun2nix follow project nixpkgs: that changes its output path and can miss the upstream cache.

Upstream [recommends generating `bun.nix` through a postinstall hook](https://github.com/nix-community/bun2nix/blob/0f2a1f0b6f42cebe3b149bf62d38754c5e0e9729/docs/src/using-the-command-line-tool.md). This Nix-only project instead generates the expression from `bun.lock` in the store. It composes the supported converter and `fetchBunDeps` APIs; it is not a direct upstream `bun.lock` builder API. There is no committed `bun.nix` or install hook. Frozen installs disable lifecycle scripts.

The tradeoff is import-from-derivation: Nix evaluation must realize the converter and generated expression. IFD is enabled by default in Nix; if disabled locally, pass `--option allow-import-from-derivation true`. Current dependencies are registry packages with lockfile hashes. Git or tarball dependencies that require generator network access would need a different workflow.

Store generation lets hosted Renovate update `bun.lock` without executing a generator or leaving a stale committed expression. Restoring committed `bun.nix` would require manual regeneration on dependency PRs and a consistency check before merging, or separately configured automation allowed to run the generator. A postinstall hook alone would not make hosted updates reliable.

### Dependency updates

Renovate manages Bun/npm dependencies and lock maintenance, Nix inputs, GitHub Action digests, and the sandbox Task version. Non-major stable dependency updates and Action digests can merge only after CI passes. Major updates require dashboard approval and human review. Nix updates and Bun types require review because nixpkgs supplies the runtime and toolchain.

For a manual Bun dependency update, enter the devshell, run `bun update` for the intended packages, then run `bun run check`, `bun run test`, and `nix flake check`. Commit `package.json` and `bun.lock` together.

Update Nix inputs with `nix flake update` and commit `flake.lock`. Compare `bun --version` with `@types/bun` and the Bun engine requirement when updating nixpkgs. Shared sandbox updates must come from [nix-templates](https://github.com/meatcar/nix-templates), preserving project tasks. A Task version change also needs both verified archive checksums; Renovate cannot update those safely by changing only the version. The shared Nix installer URL has no version pin and needs review when refreshing the template.

This workflow does not depend on Renovate executing package scripts or custom `postUpgradeTasks`, and CI never writes dependency updates back to PR branches. Mend's hosted app permits a limited set of approved post-upgrade commands, not arbitrary repository commands. Installing/enabling Renovate and selecting the `check` job as a required branch-protection check are repository-owner tasks. Renovate performs green-CI automerge itself rather than delegating to GitHub's native automerge.

## Testing

Required tests use recorded PipeWire fixtures, replay subprocesses, and loopback HTTP servers. They do not need a running PipeWire server, a microphone, an Awtrix device, or network access to one. Fixture capture is separate and requires live audio hardware plus `arecord` from `alsa-utils`, available in the devshell:

```bash
bun test/fixtures/capture-fixtures.ts
```

See [test/fixtures/README.md](test/fixtures/README.md) for more details.

## How It Works

1. Spawns `pw-dump --monitor | jq` to stream PipeWire state changes
2. Parses JSON events looking for `Stream/Input/Audio` objects (microphone streams)
3. Debounces state changes to prevent rapid flickering
4. Sends HTTP requests to the Ulanzi TC001 (via Awtrix API) to show/hide "ON AIR" indicator

## License

MIT
