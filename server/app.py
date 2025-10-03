"""Flask API for the vacation scheduling system."""

from __future__ import annotations

import sys
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Any, Dict, Tuple

from flask import Flask, jsonify, request

ROOT = Path(__file__).resolve().parents[1]
root_str = str(ROOT)
if root_str not in sys.path:
    sys.path.insert(0, root_str)

from order_db import db  # noqa: E402
from order_db.db_connection import ensure_schema, seed_sample_data  # noqa: E402

app = Flask(__name__)

DEFAULT_START_TIME = time(9, 0)
DEFAULT_END_TIME = time(18, 0)


def _get_connection():
    return db.connect_db()


def _bootstrap_database() -> None:
    try:
        ensure_schema()
        seed_sample_data()
    except Exception as exc:  # pragma: no cover - bootstrap logging
        app.logger.warning("Database bootstrap failed: %s", exc)


_bootstrap_database()


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


@app.get("/health")
def health_check() -> Any:
    return {"status": "ok"}


@app.get("/employees")
def list_employees() -> Any:
    conn = _get_connection()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT id, name FROM employees ORDER BY id")
        return jsonify(cur.fetchall())
    finally:
        conn.close()


@app.get("/vacation-requests")
def list_vacation_requests() -> Any:
    employee_id = request.args.get("employee_id", type=int)
    conn = _get_connection()
    try:
        cur = conn.cursor(dictionary=True)
        base_query = """
            SELECT v.employee_id,
                   e.name AS employee_name,
                   v.vacation_date,
                   v.start_time,
                   v.end_time,
                   v.submitted_at
            FROM vacation AS v
            JOIN employees AS e ON e.id = v.employee_id
        """

        if employee_id is not None:
            cur.execute(
                base_query + " WHERE v.employee_id = %s ORDER BY v.vacation_date, v.start_time",
                (employee_id,),
            )
        else:
            cur.execute(base_query + " ORDER BY v.vacation_date, v.start_time")
        rows = cur.fetchall()
        for row in rows:
            vacation_date = row.get("vacation_date")
            submitted_at = row.get("submitted_at")
            if isinstance(vacation_date, (date, datetime)):
                row["vacation_date"] = vacation_date.strftime("%Y-%m-%d")
            if isinstance(submitted_at, datetime):
                row["submitted_at"] = submitted_at.isoformat()
            row["start_time"] = _time_to_string(row.get("start_time"))
            row["end_time"] = _time_to_string(row.get("end_time"))
        return jsonify(rows)
    finally:
        conn.close()


@app.route("/vacation-requests", methods=["POST", "OPTIONS"])
def create_vacation_request() -> Any:
    if request.method == "OPTIONS":
        return ("", 204)

    payload: Dict[str, Any] = request.get_json(force=True, silent=False) or {}
    try:
        employee_id = int(payload["employee_id"])
    except (KeyError, ValueError, TypeError):
        return jsonify({"error": "employee_id is required"}), 400

    raw_dates = payload.get("dates", [])
    if not isinstance(raw_dates, list) or not raw_dates:
        return jsonify({"error": "dates array is required"}), 400

    normalized_entries: Dict[str, Tuple[date, time, time]] = {}

    for raw in raw_dates:
        if isinstance(raw, dict):
            raw_iso = raw.get("date")
            raw_start = raw.get("start_time")
            raw_end = raw.get("end_time")
        elif isinstance(raw, str):
            raw_iso = raw
            raw_start = DEFAULT_START_TIME.strftime("%H:%M")
            raw_end = DEFAULT_END_TIME.strftime("%H:%M")
        else:
            return jsonify({"error": "dates must be strings or objects"}), 400

        if not raw_iso:
            return jsonify({"error": "date field is required"}), 400

        try:
            parsed_date = date.fromisoformat(raw_iso)
        except ValueError:
            return jsonify({"error": f"Invalid date format: {raw_iso}"}), 400

        try:
            start_time = datetime.strptime(str(raw_start), "%H:%M").time()
            end_time = datetime.strptime(str(raw_end), "%H:%M").time()
        except (TypeError, ValueError):
            return jsonify({"error": "start_time/end_time must be HH:MM"}), 400

        if start_time >= end_time:
            return jsonify({"error": "start_time must be earlier than end_time"}), 400

        normalized_entries[parsed_date.isoformat()] = (parsed_date, start_time, end_time)

    conn = _get_connection()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT 1 FROM employees WHERE id = %s", (employee_id,))
        if cur.fetchone() is None:
            return jsonify({"error": f"Employee {employee_id} not found"}), 404

        insert_payload = [
            (employee_id, iso, start_time, end_time)
            for iso, (_, start_time, end_time) in normalized_entries.items()
        ]

        cur.executemany(
            """
            INSERT INTO vacation (employee_id, vacation_date, start_time, end_time)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                vacation_date = VALUES(vacation_date),
                start_time = VALUES(start_time),
                end_time = VALUES(end_time)
            """,
            insert_payload,
        )
        conn.commit()

        placeholders = ",".join(["%s"] * len(insert_payload))
        query = f"""
            SELECT v.employee_id, e.name AS employee_name,
                   v.vacation_date, v.start_time, v.end_time, v.submitted_at
            FROM vacation AS v
            JOIN employees AS e ON e.id = v.employee_id
            WHERE v.employee_id = %s AND v.vacation_date IN ({placeholders})
            ORDER BY v.vacation_date, v.start_time
            """
        cur.execute(
            query,
            [employee_id, *[row[1] for row in insert_payload]],
        )
        rows = cur.fetchall()
        for row in rows:
            vacation_date = row.get("vacation_date")
            submitted_at = row.get("submitted_at")
            if isinstance(vacation_date, (date, datetime)):
                row["vacation_date"] = vacation_date.strftime("%Y-%m-%d")
            if isinstance(submitted_at, datetime):
                row["submitted_at"] = submitted_at.isoformat()
            row["start_time"] = _time_to_string(row.get("start_time"))
            row["end_time"] = _time_to_string(row.get("end_time"))
        return jsonify({"requests": rows}), 201
    finally:
        conn.close()


if __name__ == "__main__":
    app.run(debug=True)


def _time_to_string(value: time | timedelta | None) -> str | None:
    if isinstance(value, time):
        return value.strftime("%H:%M")
    if isinstance(value, timedelta):
        total_seconds = int(value.total_seconds())
        # TIME 欄位以 timedelta 回傳時，轉成 24 小時制字串
        minutes, _ = divmod(total_seconds, 60)
        hours, minutes = divmod(minutes, 60)
        hours %= 24
        return f"{hours:02d}:{minutes:02d}"
    if value is None:
        return None
    return str(value)
