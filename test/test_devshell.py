import json
import shutil
import subprocess


def test_development_tools_are_available():
    for tool in ("bun", "bun2nix", "pw-dump", "jq", "nil", "treefmt", "oxfmt", "oxlint"):
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


def test_runtime_and_tool_versions_match_package_requirements():
    with open("package.json") as source:
        package = json.load(source)
    bun_version = subprocess.check_output(["bun", "--version"], text=True).strip()
    assert package["devDependencies"]["@types/bun"] == bun_version
    assert package["engines"]["bun"] == f">={bun_version}"
    for tool in ("oxfmt", "oxlint"):
        version = subprocess.check_output([tool, "--version"], text=True)
        assert version.strip() == f'Version: {package["devDependencies"][tool]}'


def test_treefmt_uses_project_configuration_and_excludes_generated_files(tmp_path):
    shutil.copy(".oxfmtrc.json", tmp_path / ".oxfmtrc.json")
    nix_source = tmp_path / "flake.nix"
    nix_source.write_text("{answer=42;}")
    typescript_source = tmp_path / "index.ts"
    typescript_source.write_text("function answer(){return {value:'ready'};}")
    generated = tmp_path / "bun.nix"
    generated.write_text("{generated=42;}")
    excluded = []
    for directory in (
        "node_modules", "coverage", "dist", "out", ".direnv", ".amp", ".agents/sandbox"
    ):
        ignored = tmp_path / directory / "ignored.ts"
        ignored.parent.mkdir(parents=True)
        ignored.write_text("const untouched={value:42};")
        excluded.append(ignored)
    subprocess.run(["treefmt"], cwd=tmp_path, check=True)
    assert nix_source.read_text() == "{ answer = 42; }\n"
    assert typescript_source.read_text() == 'function answer() {\n  return { value: "ready" };\n}\n'
    assert generated.read_text() == "{generated=42;}"
    for ignored in excluded:
        assert ignored.read_text() == "const untouched={value:42};"
    subprocess.run(["treefmt", "--ci"], cwd=tmp_path, check=True)


def test_import_sorting_preserves_side_effect_execution_order(tmp_path):
    shutil.copy(".oxfmtrc.json", tmp_path / ".oxfmtrc.json")
    (tmp_path / "flake.nix").write_text("{}")
    for name, label in (("z-first", "first"), ("a-middle", "middle"), ("b-last", "last")):
        (tmp_path / f"{name}.ts").write_text(
            f'globalThis.events ??= []; globalThis.events.push("{label}"); export const value = 42;'
        )
    source = tmp_path / "index.ts"
    source.write_text(
        'import "./z-first.ts";\n'
        'import { value } from "./a-middle.ts";\n'
        'import "./b-last.ts";\n'
        'console.log(value, globalThis.events.join(","));\n'
    )
    expected = "42 first,middle,last\n"
    assert subprocess.check_output(["bun", "index.ts"], cwd=tmp_path, text=True) == expected
    subprocess.run(["treefmt"], cwd=tmp_path, check=True)
    assert subprocess.check_output(["bun", "index.ts"], cwd=tmp_path, text=True) == expected


def test_correctness_lint_rejects_errors_and_ignores_generated_files(tmp_path):
    shutil.copy(".oxlintrc.json", tmp_path / ".oxlintrc.json")
    source = tmp_path / "index.ts"
    source.write_text("export const answer = 42;\n")
    for directory in (
        "node_modules", "coverage", "dist", "out", ".direnv", ".amp", ".agents/sandbox"
    ):
        ignored = tmp_path / directory / "ignored.ts"
        ignored.parent.mkdir(parents=True)
        ignored.write_text("export const broken = {answer: 1, answer: 2};\n")
    subprocess.run(["oxlint", "--deny-warnings", "."], cwd=tmp_path, check=True)
    source.write_text("export const broken = {answer: 1, answer: 2};\n")
    result = subprocess.run(
        ["oxlint", "--deny-warnings", "."], cwd=tmp_path, capture_output=True, text=True
    )
    assert result.returncode == 1
    assert "no-dupe-keys" in result.stdout + result.stderr
