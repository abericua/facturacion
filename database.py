# -*- coding: utf-8 -*-
"""
SGSP — Motor de Base de Datos Relacional
Módulo: database.py
Arquitectura: SQLite 3NF — Fuente Única de Verdad
Versión: 1.0.0 | SGSP Elite
"""

import sqlite3
import os

# ── Ruta del volumen persistente (Railway) o carpeta local (desarrollo) ──────
DATA_DIR = os.environ.get("DATA_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "database"))
DB_PATH = os.path.join(DATA_DIR, "sgsp_master.db")


def get_db_connection():
    """Retorna una conexión con Row factory y FK activadas."""
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")   # Mejor concurrencia
    return conn


def inicializar_base_datos():
    """
    Crea todas las tablas del esquema si no existen.
    Idempotente: se puede llamar múltiples veces sin efectos secundarios.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # ── USUARIOS ─────────────────────────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Usuarios (
            UsuarioID     INTEGER PRIMARY KEY AUTOINCREMENT,
            Username      TEXT    UNIQUE NOT NULL,
            PasswordHash  TEXT    NOT NULL,
            Role          TEXT    DEFAULT 'Vendedor',
            TOTP_Secret   TEXT,
            Activo        INTEGER DEFAULT 1,
            FechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── CLIENTES ─────────────────────────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Clientes (
            ClienteID     INTEGER PRIMARY KEY AUTOINCREMENT,
            RazonSocial   TEXT    NOT NULL,
            RUC           TEXT    UNIQUE NOT NULL,
            Direccion     TEXT,
            Telefono      TEXT,
            Email         TEXT,
            FechaAlta     DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── PRODUCTOS ─────────────────────────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Productos (
            ProductoID    INTEGER PRIMARY KEY AUTOINCREMENT,
            CodigoRef     TEXT    UNIQUE NOT NULL,
            Nombre        TEXT    NOT NULL,
            Linea         TEXT    NOT NULL,
            CostoBase     REAL    NOT NULL,
            Moneda        TEXT    DEFAULT 'USD',
            MargenPct     REAL    NOT NULL DEFAULT 0.0,
            Activo        INTEGER DEFAULT 1,
            FechaModif    DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── FACTURAS ──────────────────────────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Facturas (
            FacturaID        INTEGER PRIMARY KEY AUTOINCREMENT,
            NumeroSecuencial TEXT    UNIQUE NOT NULL,
            FechaEmision     DATETIME DEFAULT CURRENT_TIMESTAMP,
            ClienteID        INTEGER,
            VendedorID       INTEGER NOT NULL,
            Moneda           TEXT    DEFAULT 'GS',
            Estado           TEXT    DEFAULT 'Activa',
            TotalGlobal      REAL    NOT NULL,
            TipoCambio       REAL    DEFAULT 1.0,
            Observacion      TEXT,
            FOREIGN KEY(ClienteID)  REFERENCES Clientes(ClienteID),
            FOREIGN KEY(VendedorID) REFERENCES Usuarios(UsuarioID)
        )
    """)

    # ── DETALLE DE FACTURAS ───────────────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Detalle_Facturas (
            DetalleID      INTEGER PRIMARY KEY AUTOINCREMENT,
            FacturaID      INTEGER NOT NULL,
            ProductoID     INTEGER NOT NULL,
            Cantidad       INTEGER NOT NULL DEFAULT 1,
            PrecioUnitario REAL    NOT NULL,
            Descuento      REAL    DEFAULT 0.0,
            FOREIGN KEY(FacturaID)  REFERENCES Facturas(FacturaID) ON DELETE CASCADE,
            FOREIGN KEY(ProductoID) REFERENCES Productos(ProductoID)
        )
    """)

    # ── ÍNDICES para acelerar los cruces más frecuentes ───────────────────────
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_facturas_fecha    ON Facturas(FechaEmision)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_facturas_estado   ON Facturas(Estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_detalle_factura   ON Detalle_Facturas(FacturaID)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_detalle_producto  ON Detalle_Facturas(ProductoID)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_productos_linea   ON Productos(Linea)")

    conn.commit()
    conn.close()
    print(f"[database.py] Base de datos inicializada en: {DB_PATH}")


if __name__ == "__main__":
    inicializar_base_datos()
    print("[database.py] Tablas creadas / verificadas correctamente.")
