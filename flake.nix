{
  description = "Monitor microphone and display an ON AIR indicator on Ulanzi TC001 running Awtrix";

  nixConfig = {
    extra-substituters = [ "https://nix-community.cachix.org" ];
    extra-trusted-public-keys = [
      "nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs="
    ];
  };

  inputs = {
    # see docs at https://flake.parts/
    flake-parts.url = "github:hercules-ci/flake-parts";
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    bun2nix.url = "github:nix-community/bun2nix";
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
        let
          inherit ((pkgs.extend inputs.bun2nix.overlays.default)) bun2nix;
          bunDeps = bun2nix.fetchBunDeps {
            bunNix = pkgs.runCommand "awtrix-bun-dependencies.nix" { } ''
              ${inputs.bun2nix.packages.${system}.default}/bin/bun2nix -l ${./bun.lock} -o "$out"
            '';
          };
        in
        {
          legacyPackages = pkgs;
          packages.default = pkgs.callPackage ./default.nix {
            inherit bun2nix bunDeps;
          };
          packages.tooling = pkgs.callPackage ./nix/tooling.nix {
            inherit bun2nix bunDeps;
          };
          checks.application = config.packages.default.overrideAttrs (old: {
            nativeBuildInputs = old.nativeBuildInputs ++ [ pkgs.jq ];
            doCheck = true;
            checkPhase = ''
              runHook preCheck
              test "$(bun --version)" = "${pkgs.bun.version}"
              AWTRIX_TEST_EXECUTABLE="$PWD/$pname" bun run test
              bun run typecheck
              runHook postCheck
            '';
          });
        };
    };
}
