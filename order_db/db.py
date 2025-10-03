"""Connection utilities for MySQL-backed storage."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Dict

try:
    import mysql.connector  # type: ignore
    from mysql.connector.connection import MySQLConnection  # type: ignore
except ModuleNotFoundError as exc:  # pragma: no cover - import guard
    raise ModuleNotFoundError(
        "mysql-connector-python is required. Install it with 'python3 -m pip install mysql-connector-python'"
    ) from exc


@dataclass(frozen=True)
class DatabaseConfig:
    host: str
    port: int
    user: str
    password: str
    database: str
    pool_name: str = "vacation_app_pool"
    pool_size: int = 5

    @classmethod
    def from_env(cls) -> "DatabaseConfig":
        return cls(
            host=os.environ.get("MYSQL_HOST", "127.0.0.1"),
            port=int(os.environ.get("MYSQL_PORT", "3306")),
            user=os.environ.get("MYSQL_USER", "spxeas"),
            password=os.environ.get("MYSQL_PASSWORD", "123456"),
            database=os.environ.get("MYSQL_DATABASE", "vacation"),
            pool_name=os.environ.get("MYSQL_POOL_NAME", "vacation_app_pool"),
            pool_size=int(os.environ.get("MYSQL_POOL_SIZE", "5")),
        )


_CONFIG: DatabaseConfig | None = None


def get_config() -> DatabaseConfig:
    global _CONFIG
    if _CONFIG is None:
        _CONFIG = DatabaseConfig.from_env()
    return _CONFIG


def connect_db(**overrides: Any) -> MySQLConnection:
    config = get_config()
    connection_kwargs: Dict[str, Any] = {
        "host": config.host,
        "port": config.port,
        "user": config.user,
        "password": config.password,
        "database": config.database,
        "pool_name": config.pool_name,
        "pool_size": config.pool_size,
        "pool_reset_session": True,
    }
    connection_kwargs.update(overrides)
    return mysql.connector.connect(**connection_kwargs)
