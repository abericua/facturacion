import os
import json
import pandas as pd
from datetime import datetime
import shutil

# Set up test environment
os.environ['TEST_MODE'] = '1'

import app
import pdf_generator

def run_audit():
    results = []
    def log(msg, status):
        results.append(f"[{status}] {msg}")
        print(f"[{status}] {msg}")

    # 1. Test Users
    try:
        users = app.load_users()
        if isinstance(users, dict) and "admin" in users:
            log("load_users() returns valid dictionary", "PASS")
        else:
            log("load_users() failed validation", "FAIL")
    except Exception as e:
        log(f"load_users() raised {e}", "FAIL")

    # 2. Test Clients
    try:
        clients = app.load_clients()
        if isinstance(clients, list):
            app.save_client({"nombre": "TEST_CLIENT", "ruc": "123", "direccion": "DIR", "telefono": "456"})
            c2 = app.load_clients()
            if any(c['nombre'] == "TEST_CLIENT" for c in c2):
                log("save_client() correctly saves and load_clients() reads", "PASS")
                # cleanup
                c2 = [c for c in c2 if c['nombre'] != "TEST_CLIENT"]
                with open(app.CLIENTS_FILE, 'w') as f: json.dump(c2, f)
            else:
                log("save_client() failed to save", "FAIL")
        else:
            log("load_clients() did not return a list", "FAIL")
    except Exception as e:
        log(f"Clients logic raised {e}", "FAIL")

    # 3. Test Products & Inventory
    try:
        df_p = app.load_products()
        if not df_p.empty and 'CODIGO' in df_p.columns and 'STOCK' in df_p.columns:
            log("load_products() returns valid DataFrame", "PASS")
            # get a real product
            test_prod = df_p.iloc[0]['CODIGO']
            initial_stock = df_p.iloc[0]['STOCK']
            
            # Test add_inventory
            app.add_inventory(test_prod, 5)
            df_p2 = app.load_products()
            new_stock = df_p2[df_p2['CODIGO'] == test_prod]['STOCK'].iloc[0]
            if new_stock == initial_stock + 5:
                log("add_inventory() accurately modifies stock", "PASS")
            else:
                log(f"add_inventory() failed: {initial_stock} + 5 = {new_stock}", "FAIL")
                
            # Test update_inventory (subtract)
            app.update_inventory([{"COD_PRODUCTO": test_prod, "_CANT_NUM": 3}])
            df_p3 = app.load_products()
            new_stock2 = df_p3[df_p3['CODIGO'] == test_prod]['STOCK'].iloc[0]
            if new_stock2 == initial_stock + 2:
                log("update_inventory() accurately subtracts stock", "PASS")
            else:
                log(f"update_inventory() failed: {initial_stock+5} - 3 = {new_stock2}", "FAIL")
                
            # Test validate_stock (insufficient)
            is_valid, msg = app.validate_stock([{"COD_PRODUCTO": test_prod, "_CANT_NUM": 999999}])
            if not is_valid and "Stock insuficiente" in msg:
                log("validate_stock() successfully catches insufficient stock", "PASS")
            else:
                log("validate_stock() failed to catch overselling", "FAIL")

            # Restore stock
            app.add_inventory(test_prod, -2)
        else:
            log("load_products() invalid format", "FAIL")
    except Exception as e:
        log(f"Products logic raised {e}", "FAIL")

    # 4. Test Sales & Voiding
    try:
        test_invoice_num = "TEST-999"
        test_sale = [{
            "FECHA": "01-01-2099",
            "DESCRIPCION": "Test",
            "CLIENTE": "Test",
            "PRECIO GS": 1000,
            "PRECIO USD": None,
            "NRO_FACTURA": test_invoice_num,
            "VENDEDOR": "Test",
            "FORMA PAGO": "Contado",
            "COD_PRODUCTO": "",
            "LINEA": "CORP"
        }]
        app.log_sales(test_sale)
        df_s = app.load_sales()
        if test_invoice_num in df_s['NRO_FACTURA'].astype(str).values:
            log("log_sales() saves sale accurately", "PASS")
            
            # Test voiding
            res = app.void_invoice(test_invoice_num)
            df_s2 = app.load_sales()
            if res and test_invoice_num not in df_s2['NRO_FACTURA'].astype(str).values:
                log("void_invoice() correctly deletes sale", "PASS")
            else:
                log("void_invoice() failed", "FAIL")
        else:
            log("log_sales() failed to save", "FAIL")
    except Exception as e:
        log(f"Sales logic raised {e}", "FAIL")
        
    # 5. Test PDF Generation
    try:
        out_pdf = "audit_test.pdf"
        data = {
            "nro_factura": "0000",
            "fecha": "01/01/2026",
            "nombre": "AUDIT TEST",
            "ruc": "123",
            "direccion": "Dir",
            "telefono": "456",
            "condicion": "Contado",
            "moneda": "PYG",
            "productos": [{"c": 1, "d": "Test Item", "p": 1000, "t": 1000}]
        }
        pdf_generator.generate_invoice_pdf(data, out_pdf)
        if os.path.exists(out_pdf):
            log("generate_invoice_pdf() creates valid PDF file", "PASS")
            os.remove(out_pdf)
        else:
            log("generate_invoice_pdf() failed to output file", "FAIL")
    except Exception as e:
        log(f"PDF Generator raised {e}", "FAIL")

    return results

if __name__ == '__main__':
    run_audit()
