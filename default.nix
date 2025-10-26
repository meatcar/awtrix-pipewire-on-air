{ mkBunDerivation, ... }:
mkBunDerivation {
	pname = "awtrix-on-air";
	version = "1.0.0";

	src = ./.;

	bunNix = ./bun.nix;

	index = "index.ts";
}
