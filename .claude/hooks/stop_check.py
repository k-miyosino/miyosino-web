"""Stop フック: コードに未コミットの変更があれば、終了する前に型チェックと ESLint で確かめる。

このリポジトリにはテストがないので、テストの代わりに型チェックと ESLint を実行する。
失敗したら stderr に出して exit 2 で返す（Claude は終了せずに修正を続ける）。
前回成功したときと変更内容が同じなら、再実行しない。
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from _checks import LINT_EXTENSIONS, check, has_node_modules

CONFIG_FILES = ("tsconfig.json", "workers/tsconfig.json", "eslint.config.mjs", "package.json")


def changed_code_files(root: Path) -> list[str]:
    status = subprocess.run(["git", "status", "--porcelain", "--untracked-files=all"], cwd=root,
                            capture_output=True, text=True, encoding="utf-8", errors="replace").stdout
    files = [line[3:].strip().strip('"').split(" -> ")[-1] for line in status.splitlines()]
    return sorted(f for f in files if f.endswith(LINT_EXTENSIONS) or f in CONFIG_FILES)


def changes_hash(root: Path, files: list[str]) -> str:
    digest = hashlib.sha256()
    for name in files:
        digest.update(name.encode())
        path = root / name
        if path.is_file():
            digest.update(path.read_bytes())
    return digest.hexdigest()


def main() -> int:
    sys.stderr.reconfigure(encoding="utf-8")
    data = json.load(sys.stdin)
    # 失敗で止めたあとの再停止では、無限ループを避けるため止めない
    if data.get("stop_hook_active"):
        return 0

    root = Path(os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())).resolve()
    files = changed_code_files(root)
    if not files:
        return 0

    # Node や依存パッケージのない環境（npm ci 前のクラウド環境など）では、止めずに知らせるだけにする
    if shutil.which("node") is None or not has_node_modules(root):
        print("node または node_modules が見つからないため、終了前の型チェックと ESLint を実行しませんでした"
              "（npm ci で入れられる）。", file=sys.stderr)
        return 0

    cache = Path(tempfile.gettempdir()) / (
        "claude-stop-check-" + hashlib.sha256(str(root).encode()).hexdigest()[:12])
    current = changes_hash(root, files)
    if cache.is_file() and cache.read_text() == current:
        return 0

    # 設定ファイルを変えたときは、ルートの型チェックを必ず実行する
    targets = files if not any(f in CONFIG_FILES for f in files) else [*files, "next.config.ts"]
    failures = check(root, targets)
    if not failures:
        cache.write_text(current)
        return 0

    print("型チェックまたは ESLint でエラーがあります。直してから終了してください。", file=sys.stderr)
    print("\n\n".join(failures), file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
