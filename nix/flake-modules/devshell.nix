{
  imports = [ ./treefmt.nix ];
  perSystem =
    {
      pkgs,
      config,
      inputs',
      lib,
      ...
    }:
    {
      devShells.default = pkgs.mkShell {
        name = "awtrix-pipewire-on-air";
        inputsFrom = [
          config.flake-root.devShell
          config.treefmt.build.devShell
        ];
        buildInputs =
          builtins.attrValues config.treefmt.build.programs
          ++ (with pkgs; [
            bun
            nil
            pipewire
            jq
            alsa-utils
          ])
          ++ [ inputs'.bun2nix.packages.default ];
      };
      checks.devshell = config.devShells.default.overrideAttrs (old: {
        name = "awtrix-devshell-check";
        nativeBuildInputs = old.nativeBuildInputs ++ [ pkgs.python3Packages.pytest ];
        src = lib.fileset.toSource {
          root = ../..;
          fileset = lib.fileset.unions [
            ../../flake.nix
            ../../package.json
            ../../.oxfmtrc.json
            ../../.oxlintrc.json
            ../../test/test_devshell.py
          ];
        };
        buildPhase = ''
          cp -r "$src" project
          chmod -R u+w project
          cd project
          export HOME="$TMPDIR/home"
          mkdir -p "$HOME"
          eval "$shellHook"
          pytest -q -p no:cacheprovider test/test_devshell.py
          touch "$out"
        '';
      });
    };
}
