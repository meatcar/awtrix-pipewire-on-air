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
          biome = {
            enable = true;
            formatCommand = "format";
          };
        };
        settings.formatter.biome.options = lib.mkForce [
          "format"
          "--write"
          "--no-errors-on-unmatched"
        ];
      };
      formatter = config.treefmt.build.wrapper;
    };
}
