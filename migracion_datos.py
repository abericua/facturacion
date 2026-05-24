# -*- coding: utf-8 -*-
"""
SGSP — Migración de Datos Históricos
Módulo: migracion_datos.py

Ejecutar UNA SOLA VEZ desde local para poblar sgsp_master.db
con los datos existentes en CSV y Excel.

Uso:
    cd C:\\Users\\beric\\OneDrive\\Desktop\\SGSP
    python migracion_datos.py
"""

import sqlite3
import pandas as pd
import os
import sys

# ── Rutas ──────────────────────────────────────────────────────────────────
BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
DATA_DIR  = os.environ.get("DATA_DIR", os.path.join(BASE_DIR, "database"))
DB_PATH   = os.path.join(DATA_DIR, "sgsp_master.db")

# Archivos fuente — ajustar si están en subcarpeta diferente
CSV_PRODUCTOS = os.path.join(BASE_DIR, "database", "productos_maestros.csv")
EXCEL_VENTAS  = os.path.join(BASE_DIR, "database", "VENTAS TOTALES 2026.xlsx")

# ── Columnas requeridas ────────────────────────────────────────────────────
COLS_PRODUCTOS = {"ID_Ref", "Nombre", "Linea", "Costo_Compra", "Moneda_Costo", "Margen_Pct"}
COLS_VENTAS    = {"NUMERO", "DESCRIPCION", "PRECIO GS"}


def verificar_archivos():
    """Verifica que los archivos fuente existan antes de migrar."""
    ok = True
    for ruta, nombre in [(CSV_PRODUCTOS, "productos_maestros.csv"),
                         (EXCEL_VENTAS,  "VENTAS TOTALES 2026.xlsx")]:
        if not os.path.exists(ruta):
            print(f"[ERROR] No se encontró: {ruta}")
            ok = False
        else:
            print(f"[OK] Encontrado: {nombre}")
    return ok


def verificar_columnas(df, requeridas, nombre_archivo):
    """Verifica que el DataFrame tenga las columnas esperadas."""
    presentes = set(df.columns.tolist())
    faltantes  = requeridas - presentes
    if faltantes:
        print(f"\n[ERROR] {nombre_archivo} — Columnas faltantes: {faltantes}")
        print(f"        Columnas presentes:  {sorted(presentes)}")
        return False
    print(f"[OK] Columnas de {nombre_archivo} verificadas: {sorted(requeridas)}")
    return True


def migrar_productos(cursor, df):
    """Inserta productos del CSV en la tabla Productos."""
    insertados = 0
    omitidos   = 0
    for _, row in df.iterrows():
        try:
            cursor.execute("""
                INSERT OR IGNORE INTO Productos
                    (CodigoRef, Nombre, Linea, CostoBase, Moneda, MargenPct)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                str(row["ID_Ref"]).strip(),
                str(row["Nombre"]).strip(),
                str(row["Linea"]).strip(),
                float(row["Costo_Compra"]),
                str(row["Moneda_Costo"]).strip(),
                float(row["Margen_Pct"])
            ))
            if cursor.rowcount > 0:
                insertados += 1
            else:
                omitidos += 1
        except Exception as e:
            print(f"  [WARN] Fila {_} productos: {e}")
    print(f"  Productos → Insertados: {insertados} | Ya existían: {omitidos}")


def migrar_ventas(cursor, df, mapa_productos):
    """
    Inserta facturas históricas del Excel.
    Usa mapa_productos (nombre_lower → ProductoID) para resolver FK por nombre.
    """
    df_activas = df[df["DESCRIPCION"].astype(str).str.strip().str.upper() != "ANULADA"].copy()

    # Crear un usuario histórico para el vendedor de datos migrados
    cursor.execute("""
        INSERT OR IGNORE INTO Usuarios (UsuarioID, Username, PasswordHash, Role)
        VALUES (999, 'migracion_historica', 'NO_LOGIN', 'Sistema')
    """)

    fact_ok   = 0
    fact_fail = 0
    det_ok    = 0
    det_miss  = 0

    for _, row in df_activas.iterrows():
        try:
            numero = str(row["NUMERO"]).strip()
            total  = float(row["PRECIO GS"])

            cursor.execute("""
                INSERT OR IGNORE INTO Facturas
                    (NumeroSecuencial, VendedorID, Estado, TotalGlobal)
                VALUES (?, 999, 'Activa', ?)
            """, (numero, total))

            if cursor.rowcount == 0:
                # Factura ya existía
                fact_fail += 1
                continue

            factura_id = cursor.lastrowid
            fact_ok   += 1

            # Intentar vincular al producto por nombre
            nombre_lower = str(row["DESCRIPCION"]).strip().lower()
            producto_id  = mapa_productos.get(nombre_lower)

            if producto_id:
                cursor.execute("""
                    INSERT INTO Detalle_Facturas
                        (FacturaID, ProductoID, Cantidad, PrecioUnitario)
                    VALUES (?, ?, 1, ?)
                """, (factura_id, producto_id, total))
                det_ok += 1
            else:
                det_miss += 1

        except Exception as e:
            print(f"  [WARN] Fila {_} ventas: {e}")
            fact_fail += 1

    print(f"  Facturas  → Insertadas: {fact_ok} | Duplicadas/Error: {fact_fail}")
    print(f"  Detalles  → Con producto: {det_ok} | Sin match nombre: {det_miss}")
    if det_miss > 0:
        print(f"  [INFO] Los {det_miss} detalles sin match quedaron sin ProductoID.")
        print("         Esto es normal en la migración inicial — corrección manual posible.")


def ejecutar_migracion():
    """Función principal de migración. Idempotente por INSERT OR IGNORE."""
    print("=" * 60)
    print("SGSP — Migración de Datos Históricos")
    print("=" * 60)

    # 1. Verificar archivos
    if not verificar_archivos():
        print("\n[ABORTADO] Corrige las rutas de los archivos fuente.")
        sys.exit(1)

    # 2. Cargar DataFrames
    print("\nCargando archivos...")
    df_productos = pd.read_csv(CSV_PRODUCTOS)
    df_ventas    = pd.read_excel(EXCEL_VENTAS)

    print(f"\nColumnas CSV  productos: {df_productos.columns.tolist()}")
    print(f"Columnas Excel ventas:   {df_ventas.columns.tolist()}")

    # 3. Verificar columnas
    if not verificar_columnas(df_productos, COLS_PRODUCTOS, "productos_maestros.csv"):
        sys.exit(1)
    if not verificar_columnas(df_ventas, COLS_VENTAS, "VENTAS TOTALES 2026.xlsx"):
        sys.exit(1)

    # 4. Conectar y migrar
    os.makedirs(DATA_DIR, exist_ok=True)
    conn   = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON")

    print("\n[1/2] Migrando productos...")
    migrar_productos(cursor, df_productos)

    # Construir mapa nombre → ProductoID después de insertar productos
    cursor.execute("SELECT ProductoID, Nombre FROM Productos")
    mapa_productos = {row[1].strip().lower(): row[0] for row in cursor.fetchall()}
    print(f"  Mapa de productos construido: {len(mapa_productos)} entradas")

    print("\n[2/2] Migrando ventas / facturas...")
    migrar_ventas(cursor, df_ventas, mapa_productos)

    conn.commit()
    conn.close()

    print("\n" + "=" * 60)
    print(f"[COMPLETADO] Base de datos migrada: {DB_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    ejecutar_migracion()
