#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
migrate_all.py — Migración única de archivos JSON/CSV/Excel → PostgreSQL

CÓMO USARLO:
  En Railway Console (o localmente con DATABASE_URL configurado):
    python migrate_all.py

  Con --dry-run para ver qué haría sin escribir nada:
    python migrate_all.py --dry-run

  Para migrar solo algunas entidades:
    python migrate_all.py --solo ventas,compras

Tablas que se crean/populan:
  sgsp_tipo_cambio          ← database/master_tipo_cambio.json
  sgsp_tipo_cambio_historico← database/master_tipo_cambio.json (.historico)
  sgsp_clientes             ← database/master_clientes.json
  sgsp_productos            ← database/master_productos.json + database/productos_maestros.csv
  sgsp_pedidos              ← database/pedidos.json
  sgsp_pagos                ← database/pagos.json
  sgsp_pedido_items         ← database/pedido_items.json
  sgsp_compras              ← database/compras_proveedores.json
  sgsp_iva_mensual          ← database/finanzas_pro.json (.iva_mensual)
  sgsp_ventas               ← database/VENTAS TOTALES 2026.xlsx
                              (también busca en el Railway Volume /app/data/)
"""

import os
import sys
import json
import argparse
from datetime import datetime

# ── Paths ──────────────────────────────────────────────────────────────────
BASE_DIR       = os.path.dirname(os.path.abspath(__file__))
PERSISTENT_DIR = "/app/data"
# Prioridad: Railway Volume → local database/
DB_DIR = PERSISTENT_DIR if os.path.exists(PERSISTENT_DIR) else os.path.join(BASE_DIR, "database")

def _path(*parts):
    """Resuelve una ruta dentro de DB_DIR (o BASE_DIR si es Excel)."""
    return os.path.join(DB_DIR, *parts)

def _exists(p):
    return os.path.exists(p) and os.path.getsize(p) > 0


# ── Import db_sgsp ──────────────────────────────────────────────────────────
sys.path.insert(0, BASE_DIR)
import db_sgsp


# ══════════════════════════════════════════════════════════════════════════
def migrate_tipo_cambio(dry=False):
    p = _path("master_tipo_cambio.json")
    if not _exists(p):
        print(f"  [SKIP] master_tipo_cambio.json no encontrado en {DB_DIR}")
        return 0

    with open(p, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if dry:
        print(f"  [DRY] tipo_cambio: dolar={data.get('dolar_mercado')}, historico={len(data.get('historico', []))} entradas")
        return 1

    ok = db_sgsp.upsert_tipo_cambio(data)

    # Historico
    historico = data.get("historico", [])
    import psycopg2
    conn = db_sgsp.get_conn()
    cur = conn.cursor()
    for h in historico:
        try:
            cur.execute("""
                INSERT INTO sgsp_tipo_cambio_historico
                    (fecha, dolar_mercado, banda_piso, banda_techo, actualizado_por)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
            """, (
                h.get('fecha', ''),
                float(h.get('dolar_mercado', 0) or 0),
                float(h.get('banda_piso', 0) or 0),
                float(h.get('banda_techo', 0) or 0),
                h.get('actualizado_por', 'migración'),
            ))
        except Exception as e:
            print(f"    [WARN] historico entry: {e}")
    conn.commit()
    cur.close()
    conn.close()

    print(f"  ✅ tipo_cambio: upsert OK, {len(historico)} entradas históricas")
    return 1


def migrate_clientes(dry=False):
    p = _path("master_clientes.json")
    if not _exists(p):
        print(f"  [SKIP] master_clientes.json no encontrado")
        return 0

    with open(p, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Soporta dict {ruc: {...}} y lista [...]
    if isinstance(data, dict):
        clientes = list(data.values())
    else:
        clientes = data

    if dry:
        print(f"  [DRY] clientes: {len(clientes)} registros")
        return len(clientes)

    ok = err = 0
    for c in clientes:
        if not c.get('id_solpro'):
            c['id_solpro'] = c.get('ruc', c.get('RUC', ''))
        if db_sgsp.upsert_cliente(c):
            ok += 1
        else:
            err += 1
    print(f"  ✅ clientes: {ok} insertados/actualizados, {err} errores")
    return ok


def migrate_productos(dry=False):
    insertados = 0

    # 1. master_productos.json
    p_json = _path("master_productos.json")
    if _exists(p_json):
        with open(p_json, 'r', encoding='utf-8') as f:
            data = json.load(f)
        prods = list(data.values()) if isinstance(data, dict) else data

        if dry:
            print(f"  [DRY] productos (JSON): {len(prods)} registros")
        else:
            ok = err = 0
            for p in prods:
                if not p.get('id_solpro'):
                    p['id_solpro'] = p.get('nombre_canonico', p.get('Nombre', ''))
                if db_sgsp.upsert_producto(p):
                    ok += 1
                else:
                    err += 1
            insertados += ok
            print(f"  ✅ productos (JSON): {ok} OK, {err} errores")

    # 2. productos_maestros.csv
    p_csv = _path("productos_maestros.csv")
    if not _exists(p_csv):
        # También buscar en carpeta raíz (Calculadora de precios)
        p_csv = os.path.join(BASE_DIR, "Calculadora de precios solpro", "productos_maestros.csv")
    if _exists(p_csv):
        try:
            import pandas as pd
            df = pd.read_csv(p_csv)
            df = df.where(pd.notna(df), None)
            records = df.to_dict(orient='records')

            if dry:
                print(f"  [DRY] productos (CSV): {len(records)} registros")
            else:
                ok = err = 0
                for r in records:
                    # Mapeo columnas CSV → schema
                    prod = {
                        'id_solpro':        str(r.get('ID_Ref') or r.get('id_solpro') or r.get('Nombre', '')).strip(),
                        'nombre_canonico':  str(r.get('Nombre') or r.get('nombre_canonico', '')).strip(),
                        'codigo_proveedor': str(r.get('ID_Ref') or r.get('Codigo_Proveedor', '')).strip(),
                        'proveedor':        str(r.get('Proveedor') or r.get('proveedor', '')).strip(),
                        'linea':            str(r.get('Linea') or r.get('linea', '')).strip(),
                        'moneda_costo':     str(r.get('Moneda_Costo') or r.get('moneda_costo', 'USD')).strip(),
                        'costo':            float(r.get('Costo_Compra') or r.get('costo', 0) or 0),
                        'costo_usd':        float(r.get('Costo_USD') or r.get('costo_usd', 0) or 0),
                        'margen_pct':       float(r.get('Margen_Pct') or r.get('margen_pct', 0) or 0),
                        'stock_actual':     float(r.get('Stock') or r.get('stock_actual', 0) or 0),
                        'activo':           True,
                    }
                    if not prod['id_solpro']:
                        continue
                    if db_sgsp.upsert_producto(prod):
                        ok += 1
                    else:
                        err += 1
                insertados += ok
                print(f"  ✅ productos (CSV): {ok} OK, {err} errores")
        except Exception as e:
            print(f"  ⚠️  Error leyendo CSV de productos: {e}")
    else:
        print(f"  [SKIP] productos_maestros.csv no encontrado")

    return insertados


def migrate_pedidos(dry=False):
    p = _path("pedidos.json")
    if not _exists(p):
        print(f"  [SKIP] pedidos.json no encontrado")
        return 0

    with open(p, 'r', encoding='utf-8') as f:
        data = json.load(f)
    pedidos = list(data.values()) if isinstance(data, dict) else data

    if dry:
        print(f"  [DRY] pedidos: {len(pedidos)} registros")
        return len(pedidos)

    ok = err = 0
    for p in pedidos:
        if db_sgsp.upsert_pedido(p):
            ok += 1
        else:
            err += 1
    print(f"  ✅ pedidos: {ok} OK, {err} errores")
    return ok


def migrate_pagos(dry=False):
    p = _path("pagos.json")
    if not _exists(p):
        print(f"  [SKIP] pagos.json no encontrado")
        return 0

    with open(p, 'r', encoding='utf-8') as f:
        data = json.load(f)
    pagos = list(data.values()) if isinstance(data, dict) else data

    if dry:
        print(f"  [DRY] pagos: {len(pagos)} registros")
        return len(pagos)

    ok = err = 0
    for p in pagos:
        if db_sgsp.upsert_pago(p):
            ok += 1
        else:
            err += 1
    print(f"  ✅ pagos: {ok} OK, {err} errores")
    return ok


def migrate_items(dry=False):
    p = _path("pedido_items.json")
    if not _exists(p):
        print(f"  [SKIP] pedido_items.json no encontrado")
        return 0

    with open(p, 'r', encoding='utf-8') as f:
        data = json.load(f)
    items = list(data.values()) if isinstance(data, dict) else data

    if dry:
        print(f"  [DRY] pedido_items: {len(items)} registros")
        return len(items)

    ok = err = 0
    for item in items:
        if db_sgsp.upsert_item(item):
            ok += 1
        else:
            err += 1
    print(f"  ✅ pedido_items: {ok} OK, {err} errores")
    return ok


def migrate_compras(dry=False):
    p = _path("compras_proveedores.json")
    if not _exists(p):
        print(f"  [SKIP] compras_proveedores.json no encontrado")
        return 0

    with open(p, 'r', encoding='utf-8') as f:
        records = json.load(f)
    if isinstance(records, dict):
        records = list(records.values())

    if dry:
        print(f"  [DRY] compras: {len(records)} registros")
        return len(records)

    result = db_sgsp.sync_compras_bulk(records)
    if 'error' in result:
        print(f"  ❌ compras error: {result['error']}")
        return 0
    print(f"  ✅ compras: {result.get('insertados', 0)} insertados")
    return result.get('insertados', 0)


def migrate_iva(dry=False):
    p = _path("finanzas_pro.json")
    if not _exists(p):
        print(f"  [SKIP] finanzas_pro.json no encontrado")
        return 0

    with open(p, 'r', encoding='utf-8') as f:
        finanzas = json.load(f)

    iva = finanzas.get("iva_mensual", {})
    if not iva:
        print(f"  [SKIP] finanzas_pro.json sin clave iva_mensual")
        return 0

    if dry:
        print(f"  [DRY] iva_mensual: {len(iva)} periodos")
        return len(iva)

    ok = err = 0
    for periodo, datos in iva.items():
        try:
            db_sgsp.upsert_iva(periodo, datos)
            ok += 1
        except Exception as e:
            print(f"    [WARN] IVA {periodo}: {e}")
            err += 1
    print(f"  ✅ iva_mensual: {ok} periodos OK, {err} errores")
    return ok


def migrate_ventas(dry=False):
    # Busca el Excel en varios lugares
    candidatos = [
        _path("VENTAS TOTALES 2026.xlsx"),
        os.path.join(BASE_DIR, "database", "VENTAS TOTALES 2026.xlsx"),
        os.path.join(BASE_DIR, "VENTAS TOTALES 2026.xlsx"),
    ]
    excel_path = next((c for c in candidatos if _exists(c)), None)

    if not excel_path:
        print(f"  [SKIP] 'VENTAS TOTALES 2026.xlsx' no encontrado")
        return 0

    try:
        import pandas as pd
        df = pd.read_excel(excel_path)
    except Exception as e:
        print(f"  ❌ Error leyendo Excel: {e}")
        return 0

    df = df.where(pd.notna(df), None)
    records = df.to_dict(orient='records')

    if dry:
        print(f"  [DRY] ventas: {len(records)} filas en {excel_path}")
        return len(records)

    result = db_sgsp.sync_ventas_bulk(records)
    if 'error' in result:
        print(f"  ❌ ventas error: {result['error']}")
        return 0
    print(f"  ✅ ventas: {result.get('insertados', 0)} filas insertadas desde {excel_path}")
    return result.get('insertados', 0)


# ══════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════
TAREAS = {
    "tipo_cambio": migrate_tipo_cambio,
    "clientes":    migrate_clientes,
    "productos":   migrate_productos,
    "pedidos":     migrate_pedidos,
    "pagos":       migrate_pagos,
    "items":       migrate_items,
    "compras":     migrate_compras,
    "iva":         migrate_iva,
    "ventas":      migrate_ventas,
}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migración JSON/CSV/Excel → PostgreSQL")
    parser.add_argument("--dry-run", action="store_true", help="Ver qué se migraría sin escribir")
    parser.add_argument("--solo", type=str, help="Migrar solo estas entidades (comma-separated). Opciones: " + ", ".join(TAREAS.keys()))
    args = parser.parse_args()

    dry = args.dry_run
    if dry:
        print("\n⚠️  MODO DRY-RUN — no se escribirá nada en la BD\n")

    if not os.environ.get("DATABASE_URL"):
        print("❌ DATABASE_URL no está configurada. Saliendo.")
        sys.exit(1)

    print(f"📂 Directorio de datos: {DB_DIR}")
    print(f"🗄️  PostgreSQL: {os.environ.get('DATABASE_URL', '')[:40]}...\n")

    # Inicializar tablas
    if not dry:
        print("🔧 Inicializando tablas...")
        ok = db_sgsp.init_db()
        if not ok:
            print("❌ Error al inicializar tablas. Verificar DATABASE_URL y permisos.")
            sys.exit(1)
        print()

    # Selección de tareas
    if args.solo:
        tareas_sel = [t.strip() for t in args.solo.split(",")]
        tareas_run = {k: v for k, v in TAREAS.items() if k in tareas_sel}
        if not tareas_run:
            print(f"❌ Ninguna tarea válida en --solo. Opciones: {', '.join(TAREAS.keys())}")
            sys.exit(1)
    else:
        tareas_run = TAREAS

    total = 0
    inicio = datetime.utcnow()

    for nombre, fn in tareas_run.items():
        print(f"▶  {nombre}...")
        try:
            n = fn(dry=dry)
            total += (n or 0)
        except Exception as e:
            print(f"  ❌ Error en {nombre}: {e}")

    elapsed = (datetime.utcnow() - inicio).total_seconds()
    print(f"\n{'🏁 Migración completa' if not dry else '✅ Dry-run completo'}")
    print(f"   Registros procesados: {total}")
    print(f"   Tiempo: {elapsed:.1f}s")
    if not dry:
        print("\n💡 Próximos pasos:")
        print("   1. Verificar datos en Railway → PostgreSQL")
        print("   2. Reiniciar el servicio bridge-api")
        print("   3. Abrir el Backoffice y verificar datos en todos los módulos")
