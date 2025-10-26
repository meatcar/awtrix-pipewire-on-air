{
  description = "Monitor microphone and display an ON AIR indicator on Ulanzi TC001 running Awtrix";

  inputs = {
    # see docs at https://flake.parts/
    flake-parts.url = "github:hercules-ci/flake-parts";
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    bun2nix.url = "github:baileyluTCD/bun2nix";
    bun2nix.inputs.nixpkgs.follows = "nixpkgs";
  };

  nixConfig = {
      extra-substituters = [
        "https://cache.nixos.org"
        "https://cache.garnix.io"
      ];
      extra-trusted-public-keys = [
        "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY="
        "cache.garnix.io:CTFPyKSLcx5RMJKfLo5EEPUObbA78b0YQ2DTCJXqr9g="
      ];
  };

  outputs =
    inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      flake = { };
      systems = [ "x86_64-linux" ];
      perSystem =
        {
          pkgs,
          system,
          inputs',
          ...
        }:
        {
          legacyPackages = pkgs;
          packages.default = pkgs.callPackage ./default.nix {
            inherit (inputs.bun2nix.lib.${system}) mkBunDerivation;
          };
          devShells.default = pkgs.mkShell {
            name = "awtrix-pipewire-on-air";
            buildInputs = with pkgs; [
              bun
              biome
              alsa-utils
              inputs'.bun2nix.packages.default
            ];
          };
        };
    };
}
