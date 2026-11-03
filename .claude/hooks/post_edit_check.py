"""PostToolUse フック: TypeScript/JavaScript を編集したら、型チェックと ESLint で確かめる。

エラーは stderr に出して exit 2 で返す（Claude にエラーが渡り、続けて修正できる）。
"""
import json
import os
import shutil
import sys
from pathlib import Path

from _checks import LINT_EXTENSIONS, check, has_node_modules, relative


def main() -> int:
    sys.stderr.reconfigure(encoding="utf-8")
    data = json.load(sys.stdin)
    file_path = data.get("tool_input", {}).get("file_path")
    if not file_path or not file_path.endswith(LINT_EXTENSIONS):
        return 0

    root = Path(os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())).resolve()
    name = relative(Path(file_path), root)
    # node_modules がない（npm ci 前）なら、終了前の Stop フックで知らせる
    if name is None or shutil.which("node") is None or not has_node_modules(root):
        return 0

    failures = check(root, [name])
    if not failures:
        return 0

    print(f"エラーがあります（{name} を編集したあとの確認）:", file=sys.stderr)
    print("\n\n".join(failures), file=sys.stderr)
    print("複数ファイルを変更している途中なら、残りの変更を終えてから直してよい。", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
