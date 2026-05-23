import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from db_sgsp import init_db, upsert_pago

pagos_path = os.path.join(
    os.path.dirname(__file__),
    'database', 'pagos.json')

init_db()
with open(pagos_path, 'r',
    encoding='utf-8') as f:
    pagos = json.load(f)

ok = 0
fail = 0
for p in pagos:
    if upsert_pago(p):
        ok += 1
    else:
        fail += 1

print(f"Migrados: {ok} OK, {fail} fallidos")
