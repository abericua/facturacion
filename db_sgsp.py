# -*- coding: utf-8 -*-
"""
SGSP — Capa de acceso a PostgreSQL (Railway)
Todas las entidades del sistema en una sola fuente de verdad.
"""

import os
import json
import psycopg2
import psycopg2.extras
from datetime import datetime

DATABASE_URL = os.getenv("DATABASE_URL")


# ── Conexión ───────────────────────────────────────────────────────────────
def get_conn():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise Exception("DATABASE_URL no configurada en el entorno.")
    return psycopg2.connect(url, cursor_factory=psycopg2.extras.RealDictCursor)


# ── Init — crea todas las tablas si no existen ─────────────────────────────
def init_db():
    try:
        conn = get_conn()
    except Exception as e:
        print(f"[DB] Error de conexión: {e}")
        return False

    try:
        cur = conn.cursor()

        # ── PEDIDOS ────────────────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sgsp_pedidos (
                id_pedido               VARCHAR PRIMARY KEY,
                id_cliente_solpro       VARCHAR DEFAULT '',
                nombre_cliente_factura  VARCHAR DEFAULT '',
                ruc_cliente_factura     VARCHAR DEFAULT '',
                fecha_pedido            VARCHAR DEFAULT '',
                vendedor                VARCHAR DEFAULT '',
                estado                  VARCHAR DEFAULT 'entregado',
                precio_total_gs         FLOAT   DEFAULT 0,
                monto_senado_gs         FLOAT   DEFAULT 0,
                saldo_pendiente_gs      FLOAT   DEFAULT 0,
                dolar_mercado_dia       FLOAT   DEFAULT 0,
                banda_piso_dia          FLOAT   DEFAULT 0,
                banda_techo_dia         FLOAT   DEFAULT 0,
                nro_factura_sena        VARCHAR DEFAULT '',
                nro_factura_final       VARCHAR DEFAULT '',
                tipo_doc_sena           VARCHAR DEFAULT '',
                notas                   TEXT    DEFAULT '',
                creado_en               VARCHAR DEFAULT '',
                actualizado_en          VARCHAR DEFAULT '',
                created_at              TIMESTAMP DEFAULT NOW()
            )
        """)

        # ── PAGOS ──────────────────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sgsp_pagos (
                id_pago             VARCHAR PRIMARY KEY,
                id_pedido           VARCHAR DEFAULT '',
                fecha_pago          VARCHAR DEFAULT '',
                tipo                VARCHAR DEFAULT '',
                monto_gs            FLOAT   DEFAULT 0,
                forma_pago          VARCHAR DEFAULT '',
                nro_documento       VARCHAR DEFAULT '',
                tipo_documento      VARCHAR DEFAULT '',
                nro_factura         VARCHAR DEFAULT '',
                conciliado          BOOLEAN DEFAULT FALSE,
                fecha_conciliacion  VARCHAR DEFAULT '',
                observaciones       TEXT    DEFAULT '',
                created_at          TIMESTAMP DEFAULT NOW()
            )
        """)

        # ── PEDIDO ITEMS ───────────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sgsp_pedido_items (
                id_item                     VARCHAR PRIMARY KEY,
                id_pedido                   VARCHAR DEFAULT '',
                id_producto_solpro          VARCHAR DEFAULT '',
                nombre_vendido              VARCHAR DEFAULT '',
                cantidad                    FLOAT   DEFAULT 0,
                moneda_costo                VARCHAR DEFAULT 'USD',
                costo_unitario              FLOAT   DEFAULT 0,
                costo_gs_dia                FLOAT   DEFAULT 0,
                margen_pct_teorico          FLOAT   DEFAULT 0,
                precio_contado_teorico_gs   FLOAT   DEFAULT 0,
                precio_qr_teorico_gs        FLOAT   DEFAULT 0,
                precio_credito_teorico_gs   FLOAT   DEFAULT 0,
                precio_aplicado_gs          FLOAT   DEFAULT 0,
                forma_pago                  VARCHAR DEFAULT '',
                precio_esperado_gs          FLOAT   DEFAULT 0,
                diferencia_gs               FLOAT   DEFAULT 0,
                margen_real_pct             FLOAT   DEFAULT 0,
                profit_real_gs              FLOAT   DEFAULT 0,
                alerta                      BOOLEAN DEFAULT FALSE,
                stock_descontado            BOOLEAN DEFAULT FALSE,
                stock_descontado_fecha      VARCHAR DEFAULT '',
                created_at                  TIMESTAMP DEFAULT NOW()
            )
        """)

        # ── CLIENTES MAESTROS ──────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sgsp_clientes (
                id_solpro                VARCHAR PRIMARY KEY,
                ruc                      VARCHAR DEFAULT '',
                nombre_canonico          VARCHAR DEFAULT '',
                aliases                  JSONB   DEFAULT '[]',
                direccion                VARCHAR DEFAULT '',
                telefono                 VARCHAR DEFAULT '',
                email                    VARCHAR DEFAULT '',
                tipo                     VARCHAR DEFAULT '',
                categoria                VARCHAR DEFAULT '',
                linea_credito_habilitada BOOLEAN DEFAULT FALSE,
                notas                    TEXT    DEFAULT '',
                fecha_alta               VARCHAR DEFAULT '',
                activo                   BOOLEAN DEFAULT TRUE,
                created_at               TIMESTAMP DEFAULT NOW()
            )
        """)

        # ── PRODUCTOS MAESTROS ─────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sgsp_productos (
                id_solpro           VARCHAR PRIMARY KEY,
                ids_externos        JSONB   DEFAULT '[]',
                nombre_canonico     VARCHAR DEFAULT '',
                aliases             JSONB   DEFAULT '[]',
                proveedor           VARCHAR DEFAULT '',
                linea               VARCHAR DEFAULT '',
                tipo                VARCHAR DEFAULT '',
                moneda_costo        VARCHAR DEFAULT 'USD',
                costo               FLOAT   DEFAULT 0,
                margen_pct          FLOAT   DEFAULT 0,
                stock_actual        FLOAT   DEFAULT 0,
                stock_reservado     FLOAT   DEFAULT 0,
                stock_disponible    FLOAT   DEFAULT 0,
                credito_habilitado  BOOLEAN DEFAULT FALSE,
                activo              BOOLEAN DEFAULT TRUE,
                codigo_proveedor    VARCHAR DEFAULT '',
                costo_usd           FLOAT   DEFAULT 0,
                created_at          TIMESTAMP DEFAULT NOW()
            )
        """)

        # ── TIPO DE CAMBIO (registro actual) ───────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sgsp_tipo_cambio (
                id                  SERIAL  PRIMARY KEY,
                ultima_actualizacion VARCHAR DEFAULT '',
                actualizado_por     VARCHAR DEFAULT '',
                dolar_mercado       FLOAT   DEFAULT 0,
                banda_piso          FLOAT   DEFAULT 0,
                banda_techo         FLOAT   DEFAULT 0,
                created_at          TIMESTAMP DEFAULT NOW()
            )
        """)

        # ── TIPO DE CAMBIO HISTÓRICO ───────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sgsp_tipo_cambio_historico (
                id              SERIAL  PRIMARY KEY,
                fecha           VARCHAR DEFAULT '',
                dolar_mercado   FLOAT   DEFAULT 0,
                banda_piso      FLOAT   DEFAULT 0,
                banda_techo     FLOAT   DEFAULT 0,
                actualizado_por VARCHAR DEFAULT '',
                created_at      TIMESTAMP DEFAULT NOW()
            )
        """)

        # ── COMPRAS PROVEEDORES ────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sgsp_compras (
                id              SERIAL  PRIMARY KEY,
                tipo            VARCHAR DEFAULT '',
                proveedor       VARCHAR DEFAULT '',
                proveedor_id    VARCHAR DEFAULT '',
                fecha           VARCHAR DEFAULT '',
                nro_documento   VARCHAR DEFAULT '',
                codigo          VARCHAR DEFAULT '',
                descripcion     TEXT    DEFAULT '',
                cantidad        FLOAT   DEFAULT 0,
                precio_unit_usd FLOAT   DEFAULT 0,
                subtotal_usd    FLOAT   DEFAULT 0,
                moneda          VARCHAR DEFAULT 'USD',
                precio_unit_pyg FLOAT   DEFAULT 0,
                subtotal_pyg    FLOAT   DEFAULT 0,
                datos_extra     JSONB   DEFAULT '{}',
                created_at      TIMESTAMP DEFAULT NOW()
            )
        """)

        # ── IVA MENSUAL ────────────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sgsp_iva_mensual (
                periodo                 VARCHAR PRIMARY KEY,
                total_ventas_brutas     FLOAT   DEFAULT 0,
                debito_fiscal           FLOAT   DEFAULT 0,
                credito_fiscal          FLOAT   DEFAULT 0,
                iva_a_pagar             FLOAT   DEFAULT 0,
                datos                   JSONB   DEFAULT '{}',
                created_at              TIMESTAMP DEFAULT NOW()
            )
        """)

        # ── VENTAS (del Excel maestro) ─────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sgsp_ventas (
                id          SERIAL  PRIMARY KEY,
                fecha       VARCHAR DEFAULT '',
                fecha_dt    DATE,
                cliente     VARCHAR DEFAULT '',
                descripcion TEXT    DEFAULT '',
                codigo      VARCHAR DEFAULT '',
                cantidad    INTEGER DEFAULT 1,
                precio_gs   FLOAT   DEFAULT 0,
                precio_usd  FLOAT   DEFAULT 0,
                nro_factura VARCHAR DEFAULT '',
                vendedor    VARCHAR DEFAULT '',
                anulado     BOOLEAN DEFAULT FALSE,
                datos_extra JSONB   DEFAULT '{}',
                created_at  TIMESTAMP DEFAULT NOW()
            )
        """)

        conn.commit()
        cur.close()
        conn.close()
        print("[DB] Todas las tablas inicializadas correctamente.")
        return True

    except Exception as e:
        conn.rollback()
        print(f"[DB] Error en init_db: {e}")
        return False


# ══════════════════════════════════════════════════════════════════════════
# TIPO DE CAMBIO
# ══════════════════════════════════════════════════════════════════════════
def get_tipo_cambio() -> dict:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM sgsp_tipo_cambio ORDER BY created_at DESC LIMIT 1")
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        return {}
    d = dict(row)
    # Histórico
    conn2 = get_conn()
    cur2 = conn2.cursor()
    cur2.execute("SELECT * FROM sgsp_tipo_cambio_historico ORDER BY created_at DESC LIMIT 100")
    historico = [dict(r) for r in cur2.fetchall()]
    cur2.close()
    conn2.close()
    d['historico'] = historico
    return d


def upsert_tipo_cambio(data: dict) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    try:
        # Guardar el actual en histórico primero
        cur.execute("""
            INSERT INTO sgsp_tipo_cambio_historico
                (fecha, dolar_mercado, banda_piso, banda_techo, actualizado_por)
            SELECT ultima_actualizacion, dolar_mercado, banda_piso, banda_techo, actualizado_por
            FROM sgsp_tipo_cambio ORDER BY created_at DESC LIMIT 1
        """)
        # Insertar nuevo actual
        cur.execute("""
            INSERT INTO sgsp_tipo_cambio
                (ultima_actualizacion, actualizado_por, dolar_mercado, banda_piso, banda_techo)
            VALUES (%(ultima_actualizacion)s, %(actualizado_por)s,
                    %(dolar_mercado)s, %(banda_piso)s, %(banda_techo)s)
        """, {
            'ultima_actualizacion': data.get('ultima_actualizacion', datetime.utcnow().isoformat()),
            'actualizado_por':      data.get('actualizado_por', 'sistema'),
            'dolar_mercado':        float(data.get('dolar_mercado', 0)),
            'banda_piso':           float(data.get('banda_piso', 0)),
            'banda_techo':          float(data.get('banda_techo', 0)),
        })
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"[DB] upsert_tipo_cambio error: {e}")
        return False
    finally:
        cur.close()
        conn.close()


# ══════════════════════════════════════════════════════════════════════════
# PEDIDOS
# ══════════════════════════════════════════════════════════════════════════
def get_pedidos(estado=None) -> list:
    conn = get_conn()
    cur = conn.cursor()
    if estado:
        cur.execute("SELECT * FROM sgsp_pedidos WHERE estado=%s ORDER BY creado_en DESC", (estado,))
    else:
        cur.execute("SELECT * FROM sgsp_pedidos ORDER BY creado_en DESC")
    rows = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    return rows


def upsert_pedido(p: dict) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO sgsp_pedidos (
                id_pedido, id_cliente_solpro, nombre_cliente_factura,
                ruc_cliente_factura, fecha_pedido, vendedor, estado,
                precio_total_gs, monto_senado_gs, saldo_pendiente_gs,
                dolar_mercado_dia, banda_piso_dia, banda_techo_dia,
                nro_factura_sena, nro_factura_final, tipo_doc_sena,
                notas, creado_en, actualizado_en
            ) VALUES (
                %(id_pedido)s, %(id_cliente_solpro)s, %(nombre_cliente_factura)s,
                %(ruc_cliente_factura)s, %(fecha_pedido)s, %(vendedor)s, %(estado)s,
                %(precio_total_gs)s, %(monto_senado_gs)s, %(saldo_pendiente_gs)s,
                %(dolar_mercado_dia)s, %(banda_piso_dia)s, %(banda_techo_dia)s,
                %(nro_factura_sena)s, %(nro_factura_final)s, %(tipo_doc_sena)s,
                %(notas)s, %(creado_en)s, %(actualizado_en)s
            )
            ON CONFLICT (id_pedido) DO UPDATE SET
                estado             = EXCLUDED.estado,
                precio_total_gs    = EXCLUDED.precio_total_gs,
                monto_senado_gs    = EXCLUDED.monto_senado_gs,
                saldo_pendiente_gs = EXCLUDED.saldo_pendiente_gs,
                nro_factura_sena   = EXCLUDED.nro_factura_sena,
                nro_factura_final  = EXCLUDED.nro_factura_final,
                notas              = EXCLUDED.notas,
                actualizado_en     = EXCLUDED.actualizado_en
        """, {
            'id_pedido':               p.get('id_pedido', ''),
            'id_cliente_solpro':       p.get('id_cliente_solpro', ''),
            'nombre_cliente_factura':  p.get('nombre_cliente_factura', p.get('nombre_cliente', '')),
            'ruc_cliente_factura':     p.get('ruc_cliente_factura', p.get('ruc_cliente', '')),
            'fecha_pedido':            p.get('fecha_pedido', ''),
            'vendedor':                p.get('vendedor', ''),
            'estado':                  p.get('estado', 'entregado'),
            'precio_total_gs':         float(p.get('precio_total_gs', 0) or 0),
            'monto_senado_gs':         float(p.get('monto_senado_gs', p.get('monto_señado_gs', 0)) or 0),
            'saldo_pendiente_gs':      float(p.get('saldo_pendiente_gs', 0) or 0),
            'dolar_mercado_dia':       float(p.get('dolar_mercado_dia', 0) or 0),
            'banda_piso_dia':          float(p.get('banda_piso_dia', 0) or 0),
            'banda_techo_dia':         float(p.get('banda_techo_dia', 0) or 0),
            'nro_factura_sena':        p.get('nro_factura_sena', ''),
            'nro_factura_final':       p.get('nro_factura_final', ''),
            'tipo_doc_sena':           p.get('tipo_doc_sena', ''),
            'notas':                   p.get('notas', ''),
            'creado_en':               p.get('creado_en', datetime.utcnow().isoformat()),
            'actualizado_en':          p.get('actualizado_en', datetime.utcnow().isoformat()),
        })
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"[DB] upsert_pedido error: {e}")
        return False
    finally:
        cur.close()
        conn.close()


# ══════════════════════════════════════════════════════════════════════════
# PAGOS
# ══════════════════════════════════════════════════════════════════════════
def get_pagos(conciliado=None, desde=None, hasta=None) -> list:
    conn = get_conn()
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
    rows = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    for r in rows:
        for k, v in r.items():
            if hasattr(v, 'isoformat'):
                r[k] = v.isoformat()
    return rows


def upsert_pago(p: dict) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO sgsp_pagos (
                id_pago, id_pedido, fecha_pago, tipo, monto_gs,
                forma_pago, nro_documento, tipo_documento,
                nro_factura, conciliado, fecha_conciliacion, observaciones
            ) VALUES (
                %(id_pago)s, %(id_pedido)s, %(fecha_pago)s, %(tipo)s, %(monto_gs)s,
                %(forma_pago)s, %(nro_documento)s, %(tipo_documento)s,
                %(nro_factura)s, %(conciliado)s, %(fecha_conciliacion)s, %(observaciones)s
            )
            ON CONFLICT (id_pago) DO UPDATE SET
                conciliado         = EXCLUDED.conciliado,
                fecha_conciliacion = EXCLUDED.fecha_conciliacion,
                monto_gs           = EXCLUDED.monto_gs,
                observaciones      = EXCLUDED.observaciones
        """, {
            'id_pago':            p.get('id_pago', ''),
            'id_pedido':          p.get('id_pedido', ''),
            'fecha_pago':         p.get('fecha_pago', ''),
            'tipo':               p.get('tipo', ''),
            'monto_gs':           float(p.get('monto_gs', 0) or 0),
            'forma_pago':         p.get('forma_pago', ''),
            'nro_documento':      p.get('nro_documento', ''),
            'tipo_documento':     p.get('tipo_documento', ''),
            'nro_factura':        p.get('nro_factura', ''),
            'conciliado':         bool(p.get('conciliado', False)),
            'fecha_conciliacion': p.get('fecha_conciliacion', ''),
            'observaciones':      p.get('observaciones', ''),
        })
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"[DB] upsert_pago error: {e}")
        return False
    finally:
        cur.close()
        conn.close()


def conciliar_pago(id_pago: str, conciliado: bool = True) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    fecha = datetime.utcnow().strftime('%Y-%m-%d') if conciliado else ''
    try:
        cur.execute("""
            UPDATE sgsp_pagos
            SET conciliado = %s, fecha_conciliacion = %s
            WHERE id_pago = %s
        """, (conciliado, fecha, id_pago))
        conn.commit()
        return cur.rowcount > 0
    except Exception as e:
        conn.rollback()
        print(f"[DB] conciliar_pago error: {e}")
        return False
    finally:
        cur.close()
        conn.close()


# ══════════════════════════════════════════════════════════════════════════
# PEDIDO ITEMS
# ══════════════════════════════════════════════════════════════════════════
def get_items_pedido(id_pedido: str) -> list:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM sgsp_pedido_items WHERE id_pedido=%s", (id_pedido,))
    rows = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    return rows


def upsert_item(item: dict) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO sgsp_pedido_items (
                id_item, id_pedido, id_producto_solpro, nombre_vendido,
                cantidad, moneda_costo, costo_unitario, costo_gs_dia,
                margen_pct_teorico, precio_contado_teorico_gs, precio_qr_teorico_gs,
                precio_credito_teorico_gs, precio_aplicado_gs, forma_pago,
                precio_esperado_gs, diferencia_gs, margen_real_pct, profit_real_gs,
                alerta, stock_descontado, stock_descontado_fecha
            ) VALUES (
                %(id_item)s, %(id_pedido)s, %(id_producto_solpro)s, %(nombre_vendido)s,
                %(cantidad)s, %(moneda_costo)s, %(costo_unitario)s, %(costo_gs_dia)s,
                %(margen_pct_teorico)s, %(precio_contado_teorico_gs)s, %(precio_qr_teorico_gs)s,
                %(precio_credito_teorico_gs)s, %(precio_aplicado_gs)s, %(forma_pago)s,
                %(precio_esperado_gs)s, %(diferencia_gs)s, %(margen_real_pct)s, %(profit_real_gs)s,
                %(alerta)s, %(stock_descontado)s, %(stock_descontado_fecha)s
            )
            ON CONFLICT (id_item) DO UPDATE SET
                cantidad           = EXCLUDED.cantidad,
                precio_aplicado_gs = EXCLUDED.precio_aplicado_gs,
                stock_descontado   = EXCLUDED.stock_descontado,
                stock_descontado_fecha = EXCLUDED.stock_descontado_fecha
        """, {
            'id_item':                    item.get('id_item', ''),
            'id_pedido':                  item.get('id_pedido', ''),
            'id_producto_solpro':         item.get('id_producto_solpro', ''),
            'nombre_vendido':             item.get('nombre_vendido', ''),
            'cantidad':                   float(item.get('cantidad', 0) or 0),
            'moneda_costo':               item.get('moneda_costo', 'USD'),
            'costo_unitario':             float(item.get('costo_unitario', 0) or 0),
            'costo_gs_dia':               float(item.get('costo_gs_dia', 0) or 0),
            'margen_pct_teorico':         float(item.get('margen_pct_teorico', 0) or 0),
            'precio_contado_teorico_gs':  float(item.get('precio_contado_teorico_gs', 0) or 0),
            'precio_qr_teorico_gs':       float(item.get('precio_qr_teorico_gs', 0) or 0),
            'precio_credito_teorico_gs':  float(item.get('precio_credito_teorico_gs', 0) or 0),
            'precio_aplicado_gs':         float(item.get('precio_aplicado_gs', 0) or 0),
            'forma_pago':                 item.get('forma_pago', ''),
            'precio_esperado_gs':         float(item.get('precio_esperado_gs', 0) or 0),
            'diferencia_gs':              float(item.get('diferencia_gs', 0) or 0),
            'margen_real_pct':            float(item.get('margen_real_pct', 0) or 0),
            'profit_real_gs':             float(item.get('profit_real_gs', 0) or 0),
            'alerta':                     bool(item.get('alerta', False)),
            'stock_descontado':           bool(item.get('stock_descontado', False)),
            'stock_descontado_fecha':     item.get('stock_descontado_fecha', ''),
        })
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"[DB] upsert_item error: {e}")
        return False
    finally:
        cur.close()
        conn.close()


# ══════════════════════════════════════════════════════════════════════════
# CLIENTES
# ══════════════════════════════════════════════════════════════════════════
def get_clientes(solo_activos=True) -> list:
    conn = get_conn()
    cur = conn.cursor()
    if solo_activos:
        cur.execute("SELECT * FROM sgsp_clientes WHERE activo=TRUE ORDER BY nombre_canonico")
    else:
        cur.execute("SELECT * FROM sgsp_clientes ORDER BY nombre_canonico")
    rows = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    for r in rows:
        for k in ('aliases',):
            if isinstance(r.get(k), str):
                try:
                    r[k] = json.loads(r[k])
                except Exception:
                    r[k] = []
    return rows


def upsert_cliente(c: dict) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    try:
        aliases = c.get('aliases', [])
        if isinstance(aliases, list):
            aliases = json.dumps(aliases, ensure_ascii=False)
        cur.execute("""
            INSERT INTO sgsp_clientes (
                id_solpro, ruc, nombre_canonico, aliases, direccion,
                telefono, email, tipo, categoria,
                linea_credito_habilitada, notas, fecha_alta, activo
            ) VALUES (
                %(id_solpro)s, %(ruc)s, %(nombre_canonico)s, %(aliases)s::jsonb,
                %(direccion)s, %(telefono)s, %(email)s, %(tipo)s, %(categoria)s,
                %(linea_credito_habilitada)s, %(notas)s, %(fecha_alta)s, %(activo)s
            )
            ON CONFLICT (id_solpro) DO UPDATE SET
                ruc                      = EXCLUDED.ruc,
                nombre_canonico          = EXCLUDED.nombre_canonico,
                aliases                  = EXCLUDED.aliases,
                direccion                = EXCLUDED.direccion,
                telefono                 = EXCLUDED.telefono,
                email                    = EXCLUDED.email,
                linea_credito_habilitada = EXCLUDED.linea_credito_habilitada,
                notas                    = EXCLUDED.notas,
                activo                   = EXCLUDED.activo
        """, {
            'id_solpro':                c.get('id_solpro', c.get('ruc', '')),
            'ruc':                      c.get('ruc', ''),
            'nombre_canonico':          c.get('nombre_canonico', c.get('nombre', '')),
            'aliases':                  aliases,
            'direccion':                c.get('direccion', ''),
            'telefono':                 c.get('telefono', ''),
            'email':                    c.get('email', ''),
            'tipo':                     c.get('tipo', ''),
            'categoria':                c.get('categoria', ''),
            'linea_credito_habilitada': bool(c.get('linea_credito_habilitada', False)),
            'notas':                    c.get('notas', ''),
            'fecha_alta':               c.get('fecha_alta', ''),
            'activo':                   bool(c.get('activo', True)),
        })
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"[DB] upsert_cliente error: {e}")
        return False
    finally:
        cur.close()
        conn.close()


# ══════════════════════════════════════════════════════════════════════════
# PRODUCTOS
# ══════════════════════════════════════════════════════════════════════════
def get_productos(solo_activos=True) -> list:
    conn = get_conn()
    cur = conn.cursor()
    if solo_activos:
        cur.execute("SELECT * FROM sgsp_productos WHERE activo=TRUE ORDER BY nombre_canonico")
    else:
        cur.execute("SELECT * FROM sgsp_productos ORDER BY nombre_canonico")
    rows = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    return rows


def _to_str(v, default='') -> str:
    """Convierte cualquier valor a str seguro para columnas TEXT."""
    if v is None:
        return default
    if isinstance(v, dict):
        return json.dumps(v, ensure_ascii=False)
    if isinstance(v, list):
        return json.dumps(v, ensure_ascii=False)
    return str(v)


def upsert_producto(p: dict) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    try:
        ids_ext = p.get('ids_externos', [])
        aliases = p.get('aliases', [])
        if isinstance(ids_ext, (list, dict)):
            ids_ext = json.dumps(ids_ext, ensure_ascii=False)
        if isinstance(aliases, (list, dict)):
            aliases = json.dumps(aliases, ensure_ascii=False)
        cur.execute("""
            INSERT INTO sgsp_productos (
                id_solpro, ids_externos, nombre_canonico, aliases,
                proveedor, linea, tipo, moneda_costo, costo, margen_pct,
                stock_actual, stock_reservado, stock_disponible,
                credito_habilitado, activo, codigo_proveedor, costo_usd
            ) VALUES (
                %(id_solpro)s, %(ids_externos)s::jsonb, %(nombre_canonico)s, %(aliases)s::jsonb,
                %(proveedor)s, %(linea)s, %(tipo)s, %(moneda_costo)s, %(costo)s, %(margen_pct)s,
                %(stock_actual)s, %(stock_reservado)s, %(stock_disponible)s,
                %(credito_habilitado)s, %(activo)s, %(codigo_proveedor)s, %(costo_usd)s
            )
            ON CONFLICT (id_solpro) DO UPDATE SET
                nombre_canonico   = EXCLUDED.nombre_canonico,
                aliases           = EXCLUDED.aliases,
                proveedor         = EXCLUDED.proveedor,
                costo             = EXCLUDED.costo,
                margen_pct        = EXCLUDED.margen_pct,
                stock_actual      = EXCLUDED.stock_actual,
                stock_reservado   = EXCLUDED.stock_reservado,
                stock_disponible  = EXCLUDED.stock_disponible,
                credito_habilitado= EXCLUDED.credito_habilitado,
                activo            = EXCLUDED.activo,
                codigo_proveedor  = EXCLUDED.codigo_proveedor,
                costo_usd         = EXCLUDED.costo_usd
        """, {
            'id_solpro':           p.get('id_solpro', ''),
            'ids_externos':        ids_ext,
            'nombre_canonico':     _to_str(p.get('nombre_canonico', p.get('Nombre', ''))),
            'aliases':             aliases,
            'proveedor':           _to_str(p.get('proveedor', p.get('Proveedor', ''))),
            'linea':               _to_str(p.get('linea', p.get('Linea', ''))),
            'tipo':                _to_str(p.get('tipo', '')),
            'moneda_costo':        _to_str(p.get('moneda_costo', p.get('Moneda_Costo', 'USD'))),
            'costo':               float(p.get('costo', p.get('Costo_Compra', 0)) or 0),
            'margen_pct':          float(p.get('margen_pct', p.get('Margen_Pct', 0)) or 0),
            'stock_actual':        float(p.get('stock_actual', p.get('Stock', 0)) or 0),
            'stock_reservado':     float(p.get('stock_reservado', 0) or 0),
            'stock_disponible':    float(p.get('stock_disponible', 0) or 0),
            'credito_habilitado':  bool(p.get('credito_habilitado', False)),
            'activo':              bool(p.get('activo', True)),
            'codigo_proveedor':    _to_str(p.get('codigo_proveedor', p.get('Codigo_Proveedor', p.get('ID_Ref', '')))),
            'costo_usd':           float(p.get('costo_usd', p.get('Costo_USD', 0)) or 0),
        })
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"[DB] upsert_producto error: {e}")
        return False
    finally:
        cur.close()
        conn.close()


def update_stock_producto(id_solpro: str, delta: float, costo_usd: float = 0) -> bool:
    """Suma delta al stock_actual. Si costo_usd > 0 actualiza también el costo."""
    conn = get_conn()
    cur = conn.cursor()
    try:
        if costo_usd > 0:
            cur.execute("""
                UPDATE sgsp_productos
                SET stock_actual = stock_actual + %s,
                    stock_disponible = stock_disponible + %s,
                    costo_usd = %s, costo = %s, moneda_costo = 'USD'
                WHERE id_solpro = %s OR codigo_proveedor = %s
            """, (delta, delta, costo_usd, costo_usd, id_solpro, id_solpro))
        else:
            cur.execute("""
                UPDATE sgsp_productos
                SET stock_actual = stock_actual + %s,
                    stock_disponible = stock_disponible + %s
                WHERE id_solpro = %s OR codigo_proveedor = %s
            """, (delta, delta, id_solpro, id_solpro))
        conn.commit()
        return cur.rowcount > 0
    except Exception as e:
        conn.rollback()
        print(f"[DB] update_stock_producto error: {e}")
        return False
    finally:
        cur.close()
        conn.close()


# ══════════════════════════════════════════════════════════════════════════
# COMPRAS
# ══════════════════════════════════════════════════════════════════════════
def get_compras(proveedor_id=None) -> list:
    conn = get_conn()
    cur = conn.cursor()
    if proveedor_id:
        cur.execute("SELECT * FROM sgsp_compras WHERE proveedor_id=%s ORDER BY created_at DESC", (proveedor_id,))
    else:
        cur.execute("SELECT * FROM sgsp_compras ORDER BY created_at DESC")
    rows = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    for r in rows:
        for k, v in r.items():
            if hasattr(v, 'isoformat'):
                r[k] = v.isoformat()
    return rows


def insert_compra(c: dict) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    try:
        datos_extra = c.get('datos_extra', {})
        if not isinstance(datos_extra, str):
            datos_extra = json.dumps(datos_extra, ensure_ascii=False, default=str)
        cur.execute("""
            INSERT INTO sgsp_compras (
                tipo, proveedor, proveedor_id, fecha, nro_documento,
                codigo, descripcion, cantidad,
                precio_unit_usd, subtotal_usd, moneda,
                precio_unit_pyg, subtotal_pyg, datos_extra
            ) VALUES (
                %(tipo)s, %(proveedor)s, %(proveedor_id)s, %(fecha)s, %(nro_documento)s,
                %(codigo)s, %(descripcion)s, %(cantidad)s,
                %(precio_unit_usd)s, %(subtotal_usd)s, %(moneda)s,
                %(precio_unit_pyg)s, %(subtotal_pyg)s, %(datos_extra)s::jsonb
            )
        """, {
            'tipo':            c.get('tipo', 'FAC'),
            'proveedor':       c.get('proveedor', ''),
            'proveedor_id':    c.get('proveedor_id', ''),
            'fecha':           c.get('fecha', ''),
            'nro_documento':   c.get('nro_documento', ''),
            'codigo':          c.get('codigo', ''),
            'descripcion':     c.get('descripcion', ''),
            'cantidad':        float(c.get('cantidad', 0) or 0),
            'precio_unit_usd': float(c.get('precio_unit_usd', 0) or 0),
            'subtotal_usd':    float(c.get('subtotal_usd', 0) or 0),
            'moneda':          c.get('moneda', 'USD'),
            'precio_unit_pyg': float(c.get('precio_unit_pyg', 0) or 0),
            'subtotal_pyg':    float(c.get('subtotal_pyg', 0) or 0),
            'datos_extra':     datos_extra,
        })
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"[DB] insert_compra error: {e}")
        return False
    finally:
        cur.close()
        conn.close()


def sync_compras_bulk(records: list) -> dict:
    """Reemplaza todas las compras con la lista enviada (upsert masivo)."""
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM sgsp_compras")
        insertados = 0
        for c in records:
            datos_extra = {k: v for k, v in c.items()
                           if k not in ('tipo','proveedor','proveedor_id','fecha',
                                        'nro_documento','codigo','descripcion','cantidad',
                                        'precio_unit_usd','subtotal_usd','moneda',
                                        'precio_unit_pyg','subtotal_pyg')}
            cur.execute("""
                INSERT INTO sgsp_compras (
                    tipo, proveedor, proveedor_id, fecha, nro_documento,
                    codigo, descripcion, cantidad,
                    precio_unit_usd, subtotal_usd, moneda,
                    precio_unit_pyg, subtotal_pyg, datos_extra
                ) VALUES (
                    %(tipo)s, %(proveedor)s, %(proveedor_id)s, %(fecha)s, %(nro_documento)s,
                    %(codigo)s, %(descripcion)s, %(cantidad)s,
                    %(precio_unit_usd)s, %(subtotal_usd)s, %(moneda)s,
                    %(precio_unit_pyg)s, %(subtotal_pyg)s, %(datos_extra)s::jsonb
                )
            """, {
                'tipo':            c.get('tipo', 'FAC'),
                'proveedor':       c.get('proveedor', ''),
                'proveedor_id':    c.get('proveedor_id', ''),
                'fecha':           c.get('fecha', ''),
                'nro_documento':   c.get('nro_documento', ''),
                'codigo':          c.get('codigo', ''),
                'descripcion':     c.get('descripcion', ''),
                'cantidad':        float(c.get('cantidad', 0) or 0),
                'precio_unit_usd': float(c.get('precio_unit_usd', 0) or 0),
                'subtotal_usd':    float(c.get('subtotal_usd', 0) or 0),
                'moneda':          c.get('moneda', 'USD'),
                'precio_unit_pyg': float(c.get('precio_unit_pyg', 0) or 0),
                'subtotal_pyg':    float(c.get('subtotal_pyg', 0) or 0),
                'datos_extra':     json.dumps(datos_extra, ensure_ascii=False, default=str),
            })
            insertados += 1
        conn.commit()
        return {'insertados': insertados}
    except Exception as e:
        conn.rollback()
        print(f"[DB] sync_compras_bulk error: {e}")
        return {'error': str(e)}
    finally:
        cur.close()
        conn.close()


# ══════════════════════════════════════════════════════════════════════════
# IVA MENSUAL
# ══════════════════════════════════════════════════════════════════════════
def get_iva(anio=None) -> list:
    conn = get_conn()
    cur = conn.cursor()
    if anio:
        cur.execute("SELECT * FROM sgsp_iva_mensual WHERE periodo LIKE %s ORDER BY periodo", (f"{anio}%",))
    else:
        cur.execute("SELECT * FROM sgsp_iva_mensual ORDER BY periodo")
    rows = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    return rows


def upsert_iva(periodo: str, datos: dict) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    try:
        datos_json = json.dumps(datos, ensure_ascii=False, default=str)
        cur.execute("""
            INSERT INTO sgsp_iva_mensual
                (periodo, total_ventas_brutas, debito_fiscal,
                 credito_fiscal, iva_a_pagar, datos)
            VALUES (%(periodo)s, %(tvb)s, %(df)s, %(cf)s, %(iap)s, %(datos)s::jsonb)
            ON CONFLICT (periodo) DO UPDATE SET
                total_ventas_brutas = EXCLUDED.total_ventas_brutas,
                debito_fiscal       = EXCLUDED.debito_fiscal,
                credito_fiscal      = EXCLUDED.credito_fiscal,
                iva_a_pagar         = EXCLUDED.iva_a_pagar,
                datos               = EXCLUDED.datos
        """, {
            'periodo': periodo,
            'tvb':     float(datos.get('total_ventas_brutas', datos.get('debito_fiscal', 0)) or 0),
            'df':      float(datos.get('debito_fiscal', 0) or 0),
            'cf':      float(datos.get('credito_fiscal', 0) or 0),
            'iap':     float(datos.get('iva_a_pagar', 0) or 0),
            'datos':   datos_json,
        })
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"[DB] upsert_iva error: {e}")
        return False
    finally:
        cur.close()
        conn.close()


# ══════════════════════════════════════════════════════════════════════════
# VENTAS
# ══════════════════════════════════════════════════════════════════════════
def get_ventas(excluir_anuladas=True) -> list:
    conn = get_conn()
    cur = conn.cursor()
    if excluir_anuladas:
        cur.execute("SELECT * FROM sgsp_ventas WHERE anulado=FALSE ORDER BY fecha_dt DESC NULLS LAST")
    else:
        cur.execute("SELECT * FROM sgsp_ventas ORDER BY fecha_dt DESC NULLS LAST")
    rows = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    for r in rows:
        for k, v in r.items():
            if hasattr(v, 'isoformat'):
                r[k] = v.isoformat()
    return rows


def sync_ventas_bulk(records: list) -> dict:
    """Reemplaza todas las ventas con la lista enviada."""
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM sgsp_ventas")
        insertados = 0
        for v in records:
            fecha_str = str(v.get('FECHA', v.get('fecha', '')) or '')
            datos_extra = {k: val for k, val in v.items()
                           if k not in ('FECHA','CLIENTE','DESCRIPCION','CODIGO',
                                        'CANTIDAD','PRECIO GS','PRECIO USD',
                                        'NRO_FACTURA','VENDEDOR','fecha','cliente',
                                        'descripcion','codigo','cantidad','precio_gs',
                                        'precio_usd','nro_factura','vendedor')}
            cur.execute("""
                INSERT INTO sgsp_ventas
                    (fecha, cliente, descripcion, codigo, cantidad,
                     precio_gs, precio_usd, nro_factura, vendedor,
                     anulado, datos_extra)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb)
            """, (
                fecha_str,
                str(v.get('CLIENTE', v.get('cliente', '')) or ''),
                str(v.get('DESCRIPCION', v.get('descripcion', '')) or ''),
                str(v.get('CODIGO', v.get('codigo', '')) or ''),
                int(v.get('CANTIDAD', v.get('cantidad', 1)) or 1),
                float(v.get('PRECIO GS', v.get('precio_gs', 0)) or 0),
                float(v.get('PRECIO USD', v.get('precio_usd', 0)) or 0),
                str(v.get('NRO_FACTURA', v.get('nro_factura', '')) or ''),
                str(v.get('VENDEDOR', v.get('vendedor', '')) or ''),
                bool(v.get('anulado', False)),
                json.dumps(datos_extra, ensure_ascii=False, default=str),
            ))
            insertados += 1
        conn.commit()
        return {'insertados': insertados}
    except Exception as e:
        conn.rollback()
        print(f"[DB] sync_ventas_bulk error: {e}")
        return {'error': str(e)}
    finally:
        cur.close()
        conn.close()


def get_resumen() -> dict:
    """Resumen financiero global."""
    pagos = get_pagos()
    errors = [p for p in pagos if 'error' in p]
    if errors:
        return {'error': errors[0]['error']}
    conciliados = [p for p in pagos if p.get('conciliado')]
    pendientes  = [p for p in pagos if not p.get('conciliado')]
    return {
        'total_pagos':          len(pagos),
        'total_gs':             sum(p.get('monto_gs', 0) for p in pagos),
        'conciliados':          len(conciliados),
        'monto_conciliado_gs':  sum(p.get('monto_gs', 0) for p in conciliados),
        'pendientes':           len(pendientes),
        'monto_pendiente_gs':   sum(p.get('monto_gs', 0) for p in pendientes),
        'pagos':                pagos,
    }
