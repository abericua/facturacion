import os
import psycopg2
import json
from datetime import datetime

DATABASE_URL = os.getenv("DATABASE_URL")

def get_conn():
    if not DATABASE_URL:
        return None
    try:
        return psycopg2.connect(DATABASE_URL)
    except Exception:
        return None

def init_db():
    conn = get_conn()
    if not conn:
        return False
    try:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sgsp_pagos (
                id_pago VARCHAR PRIMARY KEY,
                id_pedido VARCHAR,
                fecha_pago VARCHAR,
                tipo VARCHAR,
                monto_gs FLOAT DEFAULT 0,
                forma_pago VARCHAR,
                nro_documento VARCHAR DEFAULT '',
                tipo_documento VARCHAR DEFAULT '',
                nro_factura VARCHAR DEFAULT '',
                conciliado BOOLEAN DEFAULT FALSE,
                fecha_conciliacion VARCHAR DEFAULT '',
                observaciones TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sgsp_pedidos (
                id_pedido VARCHAR PRIMARY KEY,
                nombre_cliente VARCHAR,
                ruc_cliente VARCHAR DEFAULT '',
                fecha_pedido VARCHAR,
                vendedor VARCHAR DEFAULT '',
                estado VARCHAR DEFAULT 'entregado',
                precio_total_gs FLOAT DEFAULT 0,
                monto_senado_gs FLOAT DEFAULT 0,
                saldo_pendiente_gs FLOAT DEFAULT 0,
                nro_factura_final VARCHAR DEFAULT '',
                notas TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"DB init error: {e}")
        return False

def upsert_pago(pago: dict) -> bool:
    conn = get_conn()
    if not conn:
        return False
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO sgsp_pagos (
                id_pago, id_pedido, fecha_pago,
                tipo, monto_gs, forma_pago,
                nro_documento, tipo_documento,
                nro_factura, conciliado,
                fecha_conciliacion, observaciones
            ) VALUES (
                %(id_pago)s, %(id_pedido)s,
                %(fecha_pago)s, %(tipo)s,
                %(monto_gs)s, %(forma_pago)s,
                %(nro_documento)s,
                %(tipo_documento)s,
                %(nro_factura)s, %(conciliado)s,
                %(fecha_conciliacion)s,
                %(observaciones)s
            )
            ON CONFLICT (id_pago) DO UPDATE SET
                conciliado = EXCLUDED.conciliado,
                fecha_conciliacion =
                    EXCLUDED.fecha_conciliacion,
                observaciones = EXCLUDED.observaciones
        """, {
            'id_pago': pago.get('id_pago',''),
            'id_pedido': pago.get('id_pedido',''),
            'fecha_pago': pago.get('fecha_pago',''),
            'tipo': pago.get('tipo',''),
            'monto_gs': pago.get('monto_gs', 0),
            'forma_pago': pago.get('forma_pago',''),
            'nro_documento': pago.get(
                'nro_documento',''),
            'tipo_documento': pago.get(
                'tipo_documento',''),
            'nro_factura': pago.get(
                'nro_factura',''),
            'conciliado': pago.get(
                'conciliado', False),
            'fecha_conciliacion': pago.get(
                'fecha_conciliacion',''),
            'observaciones': pago.get(
                'observaciones','')
        })
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"upsert_pago error: {e}")
        return False

def conciliar_pago(id_pago: str,
    conciliado: bool = True) -> bool:
    conn = get_conn()
    if not conn:
        return False
    try:
        cur = conn.cursor()
        fecha = datetime.now().strftime(
            "%Y-%m-%d") if conciliado else ''
        cur.execute("""
            UPDATE sgsp_pagos
            SET conciliado = %s,
                fecha_conciliacion = %s
            WHERE id_pago = %s
        """, (conciliado, fecha, id_pago))
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"conciliar error: {e}")
        return False

def get_pagos(conciliado=None,
    desde=None, hasta=None) -> list:
    conn = get_conn()
    if not conn:
        return []
    try:
        cur = conn.cursor()
        q = "SELECT * FROM sgsp_pagos WHERE 1=1"
        params = []
        if conciliado is not None:
            q += " AND conciliado = %s"
            params.append(conciliado)
        if desde:
            q += " AND fecha_pago >= %s"
            params.append(desde)
        if hasta:
            q += " AND fecha_pago <= %s"
            params.append(hasta)
        q += " ORDER BY fecha_pago DESC"
        cur.execute(q, params)
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, r))
            for r in cur.fetchall()]
        cur.close()
        conn.close()
        # Convertir datetime a string
        for r in rows:
            for k, v in r.items():
                if hasattr(v, 'isoformat'):
                    r[k] = v.isoformat()
        return rows
    except Exception as e:
        print(f"get_pagos error: {e}")
        return []

def get_resumen() -> dict:
    pagos = get_pagos()
    conciliados = [p for p in pagos
        if p.get('conciliado')]
    pendientes = [p for p in pagos
        if not p.get('conciliado')]
    return {
        "total_pagos": len(pagos),
        "total_gs": sum(
            p.get('monto_gs',0) for p in pagos),
        "conciliados": len(conciliados),
        "monto_conciliado_gs": sum(
            p.get('monto_gs',0)
            for p in conciliados),
        "pendientes": len(pendientes),
        "monto_pendiente_gs": sum(
            p.get('monto_gs',0)
            for p in pendientes),
        "pagos": pagos
    }
