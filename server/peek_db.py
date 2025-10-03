# server/peek_db.py
import os
import mysql.connector

config = {
      "host": os.getenv("MYSQL_HOST", "127.0.0.1"),
      "user": os.getenv("MYSQL_USER", "spxeas"),
      "password": os.getenv("MYSQL_PASSWORD", "123456"),
      "database": os.getenv("MYSQL_DATABASE", "vacation"),
  }

conn = mysql.connector.connect(**config)
cursor = conn.cursor(dictionary=True)

cursor.execute("SELECT * FROM employees;")
for row in cursor.fetchall():
      print(row)

cursor.close()
conn.close()