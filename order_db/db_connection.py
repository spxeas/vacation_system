"""Schema helpers for the vacation scheduling backend."""

from __future__ import annotations

import sys
from contextlib import closing
from pathlib import Path as _Path

import mysql.connector
from mysql.connector import errorcode

if __package__ in (None, ""):
    _ROOT = _Path(__file__).resolve().parents[1]
    if str(_ROOT) not in sys.path:
        sys.path.insert(0, str(_ROOT))
    from order_db.db import connect_db, get_config
else:
    from .db import connect_db, get_config

EMPLOYEE_FIXTURES = [
    (1, "Alice"),
    (2, "Bob"),
    (3, "Charlie"),
    (4, "Diana"),
    (5, "Ethan"),
    (6, "Fiona"),
    (7, "George"),
    (8, "Hannah"),
    (9, "Ivan"),
    (10, "Judy"),
]


def ensure_schema() -> None:
    config = get_config()
    try:
        conn = connect_db(autocommit=True)
    except mysql.connector.Error as err:
        if err.errno == errorcode.ER_BAD_DB_ERROR:
            _create_database_if_missing(config)
            conn = connect_db(autocommit=True)
        else:
            raise

    with closing(conn) as conn:
        with closing(conn.cursor()) as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS employees (
                    id INT PRIMARY KEY,
                    name VARCHAR(100) NOT NULL
                )
                """
            )

            # 移除舊有的 vacation_requests 資料表以統一改用 vacation
            cur.execute("DROP TABLE IF EXISTS vacation_requests")

            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS vacation (
                    employee_id INT NOT NULL,
                    vacation_date DATE NOT NULL,
                    start_time TIME NOT NULL DEFAULT '09:00:00',
                    end_time TIME NOT NULL DEFAULT '18:00:00',
                    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (employee_id, vacation_date),
                    CONSTRAINT fk_vacation_employee FOREIGN KEY (employee_id)
                        REFERENCES employees (id) ON DELETE CASCADE
                )
                """
            )

            cur.execute("SHOW COLUMNS FROM vacation LIKE 'start_time'")
            has_start_time = cur.fetchone() is not None
            cur.execute("SHOW COLUMNS FROM vacation LIKE 'end_time'")
            has_end_time = cur.fetchone() is not None
            cur.execute("SHOW COLUMNS FROM vacation LIKE 'submitted_at'")
            has_submitted_at = cur.fetchone() is not None

            alter_clauses = []
            if not has_start_time:
                alter_clauses.append(
                    "ADD COLUMN start_time TIME NOT NULL DEFAULT '09:00:00' AFTER vacation_date"
                )
            if not has_end_time:
                position = "AFTER start_time" if not has_start_time else "AFTER vacation_date"
                alter_clauses.append(
                    f"ADD COLUMN end_time TIME NOT NULL DEFAULT '18:00:00' {position}"
                )
            if not has_submitted_at:
                alter_clauses.append(
                    "ADD COLUMN submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER end_time"
                )

            if alter_clauses:
                cur.execute("ALTER TABLE vacation " + ", ".join(alter_clauses))


def _create_database_if_missing(config) -> None:
    connection = mysql.connector.connect(
        host=config.host,
        port=config.port,
        user=config.user,
        password=config.password,
    )
    with closing(connection) as conn:
        with closing(conn.cursor()) as cur:
            cur.execute(f"CREATE DATABASE IF NOT EXISTS `{config.database}`")
        conn.commit()


def seed_sample_data() -> None:
    with closing(connect_db()) as conn:
        with closing(conn.cursor()) as cur:
            cur.execute("SELECT COUNT(*) FROM employees")
            (count,) = cur.fetchone()
            if count == 0:
                cur.executemany("INSERT INTO employees (id, name) VALUES (%s, %s)", EMPLOYEE_FIXTURES)
        conn.commit()


def main() -> None:
    ensure_schema()
    seed_sample_data()
    print("Database schema ensured and sample data seeded.")


if __name__ == "__main__":
    main()
