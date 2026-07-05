{
  description = "Monitor microphone and display an ON AIR indicator on Ulanzi TC001 running Awtrix";

  inputs = {
    # see docs at https://flake.parts/
    flake-parts.url = "github:hercules-ci/flake-parts";
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    bun2nix.url = "github:baileyluTCD/bun2nix";
    bun2nix.inputs.nixpkgs.follows = "nixpkgs";
    flake-root.url = "github:srid/flake-root";
    treefmt-nix = {
      url = "github:numtide/treefmt-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      flake = { };
      imports = [ ./nix/flake-modules/devshell.nix ];
      systems = [ "x86_64-linux" ];
      perSystem =
        {
          pkgs,
          system,
          config,
          ...
        }:
        {
          legacyPackages = pkgs;
          packages.default = pkgs.callPackage ./default.nix {
            inherit (inputs.bun2nix.lib.${system}) mkBunDerivation;
          };
          checks.application = config.packages.default.overrideAttrs {
            doCheck = true;
            checkPhase = ''
              runHook preCheck
              bun test
              bun run --bun tsc --noEmit
              runHook postCheck
            '';
          };
        };
    };
}
