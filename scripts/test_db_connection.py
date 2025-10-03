#!/usr/bin/env python3
"""Verify MySQL connectivity using the order_db helpers."""

from __future__ import annotations

from mysql.connector import Error as MySQLError  # type: ignore

from order_db.db import connect_db, get_config


def main() -> None:
    config = get_config()
    print(
        "Connecting to MySQL host=%s port=%s database=%s" % (config.host, config.port, config.database)
    )
    try:
        conn = connect_db()
    except MySQLError as exc:  # pragma: no cover - runtime diagnostic
        print(f"Connection failed: {exc}")
        return

    try:
        with conn.cursor() as cur:
            cur.execute("SHOW TABLES")
            tables = cur.fetchall()
    finally:
        conn.close()

    if tables:
        print("Existing tables:")
        for (table_name,) in tables:
            print(f"  - {table_name}")
    else:
        print("No tables found in the selected database.")


if __name__ == "__main__":
    main()
