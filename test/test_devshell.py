import shutil
import subprocess


def test_development_tools_are_available():
    for tool in ("bun", "bun2nix", "pw-dump", "jq", "nil", "treefmt"):
        executable = shutil.which(tool)
        assert executable is not None, tool
        assert executable.startswith("/nix/store/"), executable
    result = subprocess.run(
        ["bun", "--eval", "console.log('Bun is ready')"],
        check=True,
        capture_output=True,
        text=True,
    )
    assert result.stdout == "Bun is ready\n"


def test_treefmt_uses_project_configuration_and_excludes_generated_files(tmp_path):
    shutil.copy("biome.json", tmp_path / "biome.json")
    nix_source = tmp_path / "flake.nix"
    nix_source.write_text("{answer=42;}")
    typescript_source = tmp_path / "index.ts"
    typescript_source.write_text("function answer(){return {value:42};}")
    generated = tmp_path / "bun.nix"
    generated.write_text("{generated=42;}")
    dependency = tmp_path / "node_modules" / "dependency.ts"
    dependency.parent.mkdir()
    dependency.write_text("const untouched={value:42};")
    subprocess.run(["treefmt"], cwd=tmp_path, check=True)
    assert nix_source.read_text() == "{ answer = 42; }\n"
    assert typescript_source.read_text() == "function answer() {\n  return { value: 42 };\n}\n"
    assert generated.read_text() == "{generated=42;}"
    assert dependency.read_text() == "const untouched={value:42};"
    subprocess.run(["treefmt", "--ci"], cwd=tmp_path, check=True)
