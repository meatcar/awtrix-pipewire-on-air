{
  lib,
  bun2nix,
  bunDeps,
  ...
}:
bun2nix.mkDerivation {
  packageJson = ./package.json;

  src = lib.fileset.toSource {
    root = ./.;
    fileset = lib.fileset.unions [
      ./index.ts
      ./src
      ./package.json
      ./bun.lock
      ./bunfig.toml
      ./tsconfig.json
      (lib.fileset.fileFilter (file: file.hasExt "ts" || file.hasExt "json") ./test)
    ];
  };

  inherit bunDeps;
  bunCompileToBytecode = false;
  bunInstallFlags = [
    "--frozen-lockfile"
    "--linker=isolated"
  ];
  dontRunLifecycleScripts = true;
}
