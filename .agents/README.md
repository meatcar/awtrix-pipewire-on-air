# Task-based Nix sandbox

Layers onto `flake-basic`, `flake-modules`, or another Nix flake + direnv project.
No `.amp` configuration or root Taskfile is added.

Requires disposable Linux, Bash, curl, CA certificates, tar, gzip, coreutils,
and permission to create `/nix`. Task bootstrap supports x86_64 and aarch64;
the project flake must support the host system. Both base templates currently
target x86_64-linux only. Setup disables Nix build sandboxing for containers.

## Install

```sh
nix flake init -t github:meatcar/nix-templates#sandbox
chmod +x .agents/setup .agents/resume
```

Nix template initialization does not preserve executable permissions. Remove any
`.agents/` ignore rule left by older templates and commit these files. Configure
your provider to run `setup` during provisioning and `resume` on activation/wake.
Resume requires a completed setup and never installs missing tools.

## Customize

Edit [Taskfile.yml](Taskfile.yml). `before_nix` runs in the inherited environment
during both lifecycles, with host tools and Task available. Use it to authenticate
private Nix inputs. The launcher provisions Nix during setup only, then runs
`setup_auth` or `resume_auth` inside the devshell. `work` starts in a refreshed
devshell so it sees fetched credentials.

Run lifecycles through `.agents/setup` and `.agents/resume`; invoking Task directly
does not load the devshell. `SANDBOX_LIFECYCLE` is exported as `setup` or `resume`.

Insert task calls before or after a step for pre/post hooks. Add namespaced
[includes](https://taskfile.dev/docs/guide#including-other-taskfiles) for separate
project concerns. Calls in `cmds` run in order and stop on failure; Task's `deps`
field runs dependencies concurrently. Keep repeat dependency/preparation work
within your provider's resume timeout.

Commands have separate shell environments. Put persistent exports in `.envrc`
or the Nix shell, not in an earlier task. Save fetched credentials in restricted,
ignored files loaded by `.envrc`; it must tolerate missing credentials before
authentication. Avoid Task-level `dotenv` for refreshed credentials.

Update shared behavior by replacing [sandbox/](sandbox/), leaving the project
Taskfile and its includes untouched. [run.sh](sandbox/run.sh) owns phase ordering,
environment entry, and setup cleanup. It bootstraps a pinned, checksum-verified
Task release before evaluating the project flake. [nix.sh](sandbox/nix.sh)
provisions Nix/direnv and shell hooks.

## Credentials and snapshots

Setup artifacts may be shared. Keep user/thread authentication in `resume_auth`.
Put removal of temporary setup credentials and provider caches in `setup_cleanup`.
The launcher calls it on setup success or failure, outside the devshell, so cleanup
does not depend on successful provisioning or environment loading. Cleanup failure
fails setup. Forced termination can prevent cleanup.

Use [Task's defer](https://taskfile.dev/docs/guide#doing-task-cleanup-with-defer)
for resources local to one task invocation, not lifecycle-wide credentials.

Commands are silent by default, but their output remains visible. Never print
tokens or interpolate them into Task templates. Session credentials that expire
between resumes need their own refresh mechanism. Keep provider-specific logic
in project tasks; see [Amp's secrets guide](https://ampcode.com/docs/orbs/handling-secrets)
for its identity policies.
