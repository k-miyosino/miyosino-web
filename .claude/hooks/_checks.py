"""フック共通: TypeScript の型チェック（tsc）と ESLint を実行し、エラーの行だけを返す。

このリポジトリにはテストがないので、型チェックと ESLint で変更を確かめる。
- ルート（Next.js）: tsconfig.json。現在エラーなしなので、出たエラーはすべて返す
- workers/（Cloudflare Workers）: workers/tsconfig.json。対象ファイルのエラーのうち、KNOWN_WORKER_ERRORS（既存のエラー）以外を返す
- ESLint: src/ だけ（workers/ は Prettier の既存エラーが多いので対象外）。警告は無視し、エラーだけを返す
"""
import json
import subprocess
from pathlib import Path

TS_EXTENSIONS = (".ts", ".tsx")
LINT_EXTENSIONS = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")
MAX_LINES = 30

# workers/ に以前からある型エラー（ファイル名, エラーコード）。行番号は編集でずれるので見ない。
# 直したらここから消す
KNOWN_WORKER_ERRORS = {
    ("workers/api/_kintone.ts", "TS2578"),
    ("workers/api/contact.ts", "TS18046"),
    ("workers/api/greenwellness.ts", "TS2591"),
    ("workers/api/minutes.ts", "TS2339"),
}


def relative(path: Path, root: Path) -> str | None:
    try:
        return path.resolve().relative_to(root).as_posix()
    except ValueError:
        return None


def has_node_modules(root: Path) -> bool:
    return (root / "node_modules" / "typescript").is_dir()


def run_node(args: list[str], root: Path) -> subprocess.CompletedProcess:
    # npx は Windows では npx.cmd になるので、node でパッケージのスクリプトを直接実行する
    return subprocess.run(["node", *args], cwd=root, capture_output=True, text=True,
                          encoding="utf-8", errors="replace")


def tsc_errors(root: Path, workers: bool, only_files: set[str] | None = None) -> list[str]:
    """tsc --noEmit のエラー行。only_files を渡すと、そのファイルのエラーだけにする。"""
    tsc = root / "workers" / "node_modules" / "typescript" / "bin" / "tsc"
    if not workers or not tsc.is_file():
        tsc = root / "node_modules" / "typescript" / "bin" / "tsc"
    project = "workers" if workers else "."
    result = run_node([str(tsc), "--noEmit", "--pretty", "false", "-p", project], root)
    if result.returncode == 0:
        return []
    lines = [l.strip() for l in result.stdout.splitlines() if "error TS" in l]
    if only_files is not None:
        lines = [l for l in lines if error_key(l)[0] in only_files and error_key(l) not in KNOWN_WORKER_ERRORS]
    elif not lines:
        lines = [result.stdout[-2000:] + result.stderr[-1000:]]
    return lines


def error_key(line: str) -> tuple[str, str]:
    """tsc のエラー行「path(行,列): error TSxxxx: ...」から（ファイル名, エラーコード）を取り出す。"""
    path = line.split("(", 1)[0].replace("\\", "/")
    code = line.split("error ", 1)[-1].split(":", 1)[0]
    return path, code


def eslint_errors(root: Path, files: list[str]) -> list[str]:
    files = [f for f in files if f.startswith("src/") and f.endswith(LINT_EXTENSIONS)
             and (root / f).is_file()]
    if not files:
        return []
    eslint = root / "node_modules" / "eslint" / "bin" / "eslint.js"
    result = run_node([str(eslint), "--quiet", "-f", "json", *files], root)
    if result.returncode == 0:
        return []
    try:
        reports = json.loads(result.stdout)
    except json.JSONDecodeError:
        return [(result.stdout + result.stderr)[-2000:]]
    lines = []
    for report in reports:
        name = relative(Path(report["filePath"]), root) or report["filePath"]
        for m in report["messages"]:
            if m.get("severity") == 2:
                lines.append(f"{name}({m.get('line')},{m.get('column')}): "
                             f"{m.get('message')} [{m.get('ruleId')}]")
    return lines


def check(root: Path, files: list[str]) -> list[str]:
    """files（リポジトリからの相対パス）を確かめ、失敗の説明を返す。空なら成功。"""
    failures = []
    ts_files = [f for f in files if f.endswith(TS_EXTENSIONS)]
    root_ts = [f for f in ts_files if not f.startswith("workers/")]
    worker_ts = [f for f in ts_files if f.startswith("workers/")]

    if root_ts:
        lines = tsc_errors(root, workers=False)
        if lines:
            failures.append("[型チェック（tsconfig.json）]\n" + "\n".join(lines[:MAX_LINES]))
    if worker_ts:
        lines = tsc_errors(root, workers=True, only_files=set(worker_ts))
        if lines:
            failures.append("[型チェック（workers/tsconfig.json）]\n" + "\n".join(lines[:MAX_LINES]))
    lines = eslint_errors(root, files)
    if lines:
        failures.append("[ESLint]\n" + "\n".join(lines[:MAX_LINES]))
    return failures
