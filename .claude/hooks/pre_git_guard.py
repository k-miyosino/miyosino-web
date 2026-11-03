"""PreToolUse フック: 秘密情報のファイル（.env*・workers/.dev.vars・*.pem）をコミットしようとしたらブロックする。

exit 2 で返すと、そのコマンドは実行されず、stderr の内容が Claude に渡る。
.env.example や .dev.vars.example のような見本のファイルは対象外。
"""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

# ファイル名（パスの最後の部分）で判定する
SECRET_NAME = re.compile(r"^(\.env(\..+)?|\.dev\.vars(\..+)?|.+\.pem)$")
SAMPLE_SUFFIXES = (".example", ".sample", ".template")


def is_secret(path: str) -> bool:
    name = path.strip().strip("'\"").replace("\\", "/").rstrip("/").rsplit("/", 1)[-1]
    return bool(SECRET_NAME.match(name)) and not name.endswith(SAMPLE_SUFFIXES)


def git(args: list[str], root: Path) -> list[str]:
    return subprocess.run(["git", *args], cwd=root, capture_output=True, text=True,
                          encoding="utf-8", errors="replace").stdout.splitlines()


def block(reason: str) -> int:
    print(f"ブロックしました: {reason}", file=sys.stderr)
    print(".env*・workers/.dev.vars・*.pem は API キーなどの秘密情報なので絶対にコミットしない。"
          "ステージ済みなら `git reset HEAD <file>` で外すこと。", file=sys.stderr)
    return 2


def main() -> int:
    sys.stderr.reconfigure(encoding="utf-8")
    data = json.load(sys.stdin)
    command = data.get("tool_input", {}).get("command", "")
    if not re.search(r"\bgit\b", command):
        return 0

    is_add = re.search(r"\bgit\s+(?:\S+\s+)*?add\b", command)
    is_commit = re.search(r"\bgit\s+(?:\S+\s+)*?commit\b", command)
    if not (is_add or is_commit):
        return 0

    # コミットメッセージ（ヒアドキュメントや -m の文字列）にファイル名が書いてあるだけなら問題ない
    without_messages = re.sub(r"<<-?\s*['\"]?(\w+)['\"]?.*?^\1$", "", command, flags=re.S | re.M)
    without_messages = re.sub(r"@'.*?^'@", "", without_messages, flags=re.S | re.M)
    without_messages = re.sub(r"(-m|--message)\s*(\"[^\"]*\"|'[^']*')", "", without_messages)
    secrets = [w for w in re.split(r"[\s;&|()]+", without_messages) if w and is_secret(w)]
    if secrets:
        return block(f"コマンドに秘密情報のファイルが含まれています（{', '.join(secrets)}）")

    # .gitignore 済みのファイルも -f を付けるとまとめてステージされてしまう
    if is_add and re.search(r"\s(-f|--force)\b", command) and re.search(r"\s(\.|-A|--all|\*)(\s|$)", command):
        return block("git add -f で全体をステージしようとしています")

    if is_commit:
        root = Path(os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd()))
        # -a は追跡済みファイルの変更もコミットするので、追跡済みの秘密情報も確かめる
        files = git(["diff", "--cached", "--name-only"], root) + git(["ls-files"], root)
        secrets = sorted({f for f in files if is_secret(f)})
        if secrets:
            return block(f"秘密情報のファイルがステージまたは追跡されています（{', '.join(secrets)}）")

    return 0


if __name__ == "__main__":
    sys.exit(main())
