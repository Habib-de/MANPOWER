# get_actual_columns.py
import mysql.connector

conn = mysql.connector.connect(
    host='localhost',
    user='root',
    password='',
    database='manpower_db'
)

cursor = conn.cursor()

print("="*60)
print("ACTUAL COLUMN NAMES IN YOUR DATABASE")
print("="*60)

tables = ['members', 'contributions', 'loans', 'notifications']

for table in tables:
    print(f"\n📋 {table.upper()} TABLE:")
    print("-" * 40)
    cursor.execute(f"SHOW COLUMNS FROM {table}")
    for col in cursor.fetchall():
        print(f"  '{col[0]}'")  # Just show the actual column name

cursor.close()
conn.close()