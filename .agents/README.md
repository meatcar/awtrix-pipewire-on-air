# Disposable Nix sandbox

Run `.agents/setup` only in a disposable Linux environment. It installs missing
Nix/direnv tooling, disables Nix build sandboxing, and writes shell integration
under that environment's home directory. Use `nix develop` for normal host
development instead.

The shared launcher supports x86_64 and aarch64 Linux; this project's flake
supports x86_64-linux. Bootstrap needs Bash, curl, CA certificates, tar, gzip,
coreutils, and permission to create `/nix`. Both lifecycle entry points must keep
their executable bit.

## Lifecycle

Setup installs locked dependencies and runs the hardware-free development checks.
Repeated setup is safe. Resume requires a completed setup and checks the installed
tools and `node_modules` without installing dependencies or rerunning the suite.
Run setup again after dependency changes that invalidate a cached environment.

The launcher runs these tasks from [Taskfile.yml](Taskfile.yml):

1. `before_nix` in the inherited environment, before provisioning/evaluating Nix.
2. `setup_auth` or `resume_auth` inside the devshell.
3. `work` inside a refreshed devshell, so it sees fetched credentials.
4. `setup_cleanup` on setup success or failure, outside the devshell.

Use the lifecycle entry points rather than invoking Task directly; direct Task
calls do not load the devshell. `SANDBOX_LIFECYCLE` is `setup` or `resume`.
Commands in `cmds` run in order and stop on failure. Task `deps` run concurrently.
Keep resume work within the provider's timeout, which is 10 seconds for Amp.

Commands have separate shell environments. Put persistent exports in `.envrc` or
the Nix shell, not in an earlier task. Credential files must be restricted,
ignored, and optional before authentication. Avoid Task-level `dotenv` for
credentials refreshed by authentication tasks.

## Shared bootstrap maintenance

[sandbox/](sandbox/) is copied from
[meatcar/nix-templates](https://github.com/meatcar/nix-templates/tree/main/templates/sandbox/.agents).
Replace that directory when updating shared behavior; preserve the project
Taskfile and its includes. Shared scripts are excluded from project formatting.

`run.sh` pins Task and verifies the downloaded archive before extraction. Renovate
detects its version, but updates require manual review and both Linux archive
checksums from the same release. Update these in the template before copying the
scripts here. `nix.sh` uses the upstream Nix installer URL without a version pin;
review that bootstrap path during template updates. Project tooling comes from
the locked Nix flake and Bun lockfile.

## Credentials and snapshots

Setup artifacts can be shared between users. Keep user/thread authentication in
`resume_auth`. Remove temporary setup credentials and provider caches in
`setup_cleanup`; cleanup failure fails setup, and forced termination can prevent
cleanup. Use [Task's defer](https://taskfile.dev/docs/guide#doing-task-cleanup-with-defer)
for resources local to one task invocation.

Commands are silent by default, but their output remains visible. Never print
tokens or interpolate them into Task templates. See
[Amp's secrets guide](https://ampcode.com/docs/orbs/handling-secrets) for provider
identity policies. Do not use these scripts to configure a real home directory
while testing; isolate both HOME and `/nix` in a disposable container or namespace.
