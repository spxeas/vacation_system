#!/usr/bin/env python3
"""Launch the MySQL CLI using Python helpers.

This script is a small convenience wrapper around the `mysql` command. It reads
connection defaults from command-line flags or environment variables so you can
avoid typing them repeatedly while working on the vacation system backend.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from getpass import getpass
from typing import List

DEFAULTS = {
    "host": os.environ.get("MYSQL_HOST", "127.0.0.1"),
    "port": int(os.environ.get("MYSQL_PORT", "3306")),
    "user": os.environ.get("MYSQL_USER", ""),
    "database": os.environ.get("MYSQL_DATABASE", ""),
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Open the MySQL command line client with preset connection options.",
    )
    parser.add_argument(
        "--mysql-bin",
        default=os.environ.get("MYSQL_BIN", "mysql"),
        help="Path to the mysql executable (default: %(default)s)",
    )
    parser.add_argument("--host", default=DEFAULTS["host"], help="MySQL host (default: %(default)s)")
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULTS["port"],
        help="MySQL TCP port (default: %(default)s)",
    )
    parser.add_argument("--user", default=DEFAULTS["user"], help="MySQL user name")
    parser.add_argument("--database", default=DEFAULTS["database"], help="Database to use after connecting")
    parser.add_argument(
        "--ask-password",
        action="store_true",
        help="Prompt for the MySQL password instead of relying on MYSQL_PASSWORD",
    )
    parser.add_argument(
        "extra_args",
        nargs=argparse.REMAINDER,
        help="Additional arguments forwarded to the mysql client",
    )
    return parser


def resolve_mysql_binary(path_hint: str) -> str | None:
    if os.path.sep in path_hint or (os.altsep and os.altsep in path_hint):
        return path_hint if os.path.exists(path_hint) else None
    return shutil.which(path_hint)


def main(argv: List[str]) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    mysql_bin = resolve_mysql_binary(args.mysql_bin)
    if not mysql_bin:
        sys.stderr.write(
            "mysql binary not found. Install the MySQL client or set MYSQL_BIN to its path.\n"
        )
        return 1

    env = os.environ.copy()
    password = env.get("MYSQL_PASSWORD")
    if args.ask_password or not password:
        try:
            password = getpass("MySQL password: ") if args.ask_password else password
        except KeyboardInterrupt:
            sys.stderr.write("\nPassword prompt cancelled.\n")
            return 1
        if password:
            env["MYSQL_PWD"] = password
    else:
        env["MYSQL_PWD"] = password

    cmd = [mysql_bin]
    if args.host:
        cmd += ["-h", args.host]
    if args.port:
        cmd += ["-P", str(args.port)]
    if args.user:
        cmd += ["-u", args.user]
    if args.database:
        cmd += ["-D", args.database]
    if args.extra_args:
        cmd += args.extra_args

    proc = subprocess.run(cmd, env=env)
    return proc.returncode


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
