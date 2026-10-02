{
  lib,
  bun,
  bun2nix,
  bunDeps,
  makeWrapper,
}:
bun2nix.mkDerivation {
  pname = "awtrix-tooling";
  packageJson = ../package.json;
  src = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.unions [
      ../package.json
      ../bun.lock
    ];
  };
  inherit bunDeps;
  nativeBuildInputs = [ makeWrapper ];
  bunInstallFlags = [
    "--frozen-lockfile"
    "--linker=isolated"
  ];
  dontRunLifecycleScripts = true;
  dontUseBunBuild = true;
  installPhase = ''
    runHook preInstall
    mkdir -p "$out/lib" "$out/bin"
    cp -r node_modules "$out/lib/"
    for tool in oxfmt oxlint; do
      makeWrapper ${bun}/bin/bun "$out/bin/$tool" \
        --add-flags "$out/lib/node_modules/$tool/bin/$tool"
    done
    runHook postInstall
  '';
}
