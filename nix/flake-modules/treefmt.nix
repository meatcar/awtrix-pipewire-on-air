{ inputs, ... }:
{
  imports = [
    inputs.flake-root.flakeModule
    inputs.treefmt-nix.flakeModule
  ];
  perSystem =
    {
      config,
      pkgs,
      lib,
      ...
    }:
    {
      treefmt.config = {
        inherit (config.flake-root) projectRootFile;
        package = pkgs.treefmt;
        settings.global.excludes = [
          "node_modules/**"
          "coverage/**"
          "dist/**"
          "out/**"
          ".direnv/**"
          ".amp/**"
          ".agents/sandbox/**"
          "*.lock"
          "*.lockb"
          "flake.lock"
          "bun.nix"
        ];
        programs = {
          nixfmt.enable = true;
          deadnix.enable = true;
          statix.enable = true;
          oxfmt = {
            enable = true;
            package = config.packages.tooling;
          };
        };
        settings.formatter.oxfmt.command = lib.mkForce (lib.getExe' config.packages.tooling "oxfmt");
      };
      formatter = config.treefmt.build.wrapper;
    };
}
