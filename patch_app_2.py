import os
import re

app_path = r'c:\Users\beric\OneDrive\Desktop\SGSP\Creador de Facturas\app.py'

with open(app_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_log_sales = '''    def descontar_stock(items_entregados):
        import json
        master_path = os.path.join(BASE_DIR, '..', 'database', 'master_productos.json')
        if not os.path.exists(master_path): return
        with open(master_path, 'r', encoding='utf-8') as f: productos = json.load(f)
        for item in items_entregados:
            for p in productos:
                if p.get('id_solpro') == item.get('id_producto_solpro'):
                    p['stock_actual'] = max(0, p.get('stock_actual',0) - item.get('cantidad',0))
                    p['stock_reservado'] = max(0, p.get('stock_reservado',0) - item.get('cantidad',0))
                    p['stock_disponible'] = max(0, p['stock_actual'] - p['stock_reservado'])
                    break
        with open(master_path, 'w', encoding='utf-8') as f: json.dump(productos, f, indent=2, ensure_ascii=False)

    def reservar_stock(items):
        import json
        master_path = os.path.join(BASE_DIR, '..', 'database', 'master_productos.json')
        if not os.path.exists(master_path): return
        with open(master_path, 'r', encoding='utf-8') as f: productos = json.load(f)
        for item in items:
            for p in productos:
                if p.get('id_solpro') == item.get('id_producto_solpro'):
                    p['stock_reservado'] = p.get('stock_reservado',0) + item.get('cantidad',0)
                    p['stock_disponible'] = max(0, p.get('stock_actual',0) - p['stock_reservado'])
                    break
        with open(master_path, 'w', encoding='utf-8') as f: json.dump(productos, f, indent=2, ensure_ascii=False)

    def registrar_pedido(venta_data):
        import json, uuid
        from datetime import datetime
        pedidos_path = os.path.join(BASE_DIR, '..', 'database', 'pedidos.json')
        items_path = os.path.join(BASE_DIR, '..', 'database', 'pedido_items.json')
        pagos_path = os.path.join(BASE_DIR, '..', 'database', 'pagos.json')

        pedidos, items, pagos = [], [], []
        if os.path.exists(pedidos_path):
            with open(pedidos_path, 'r', encoding='utf-8') as f:
                try: pedidos = json.load(f)
                except: pass
        if os.path.exists(items_path):
            with open(items_path, 'r', encoding='utf-8') as f:
                try: items = json.load(f)
                except: pass
        if os.path.exists(pagos_path):
            with open(pagos_path, 'r', encoding='utf-8') as f:
                try: pagos = json.load(f)
                except: pass

        now = datetime.now().isoformat()
        num_pedido = len(pedidos) + 1
        id_pedido = f"PED-{num_pedido:04d}"
        es_sena = venta_data.get('es_sena', False)
        estado = 'señado' if es_sena else 'entregado'

        pedido = {
          'id_pedido': id_pedido,
          'id_cliente_solpro': venta_data.get('id_cliente_solpro', ''),
          'nombre_cliente_factura': venta_data.get('cliente',''),
          'ruc_cliente_factura': venta_data.get('ruc', ''),
          'fecha_pedido': venta_data.get('fecha',''),
          'vendedor': venta_data.get('vendedor',''),
          'estado': estado,
          'precio_total_gs': venta_data.get('total',0),
          'monto_señado_gs': venta_data.get('monto_sena', 0) if es_sena else venta_data.get('total',0),
          'saldo_pendiente_gs': venta_data.get('total',0) - venta_data.get('monto_sena', 0) if es_sena else 0,
          'dolar_mercado_dia': venta_data.get('dolar_mercado', 0),
          'banda_piso_dia': venta_data.get('banda_piso', 0),
          'banda_techo_dia': venta_data.get('banda_techo', 0),
          'nro_factura_sena': venta_data.get('nro_factura', '') if es_sena else '',
          'nro_factura_final': venta_data.get('nro_factura', '') if not es_sena else '',
          'tipo_doc_sena': venta_data.get('tipo_doc', '') if es_sena else '',
          'notas': venta_data.get('notas', ''),
          'creado_en': now,
          'actualizado_en': now
        }
        pedidos.append(pedido)

        for i, itm in enumerate(venta_data.get('items', []), 1):
            num_item = len(items) + 1
            items.append({
              'id_item': f"ITM-{num_item:04d}",
              'id_pedido': id_pedido,
              'id_producto_solpro': itm.get('id_solpro', ''),
              'nombre_vendido': itm.get('descripcion',''),
              'cantidad': itm.get('cantidad',0),
              'moneda_costo': itm.get('moneda','GS'),
              'costo_unitario': itm.get('costo', 0),
              'costo_gs_dia': itm.get('costo_gs_dia', 0),
              'margen_pct_teorico': itm.get('margen_pct', 0),
              'precio_contado_teorico_gs': itm.get('precio_contado_teorico', 0),
              'precio_qr_teorico_gs': itm.get('precio_qr_teorico', 0),
              'precio_credito_teorico_gs': itm.get('precio_credito_teorico', 0),
              'precio_aplicado_gs': itm.get('precio',0),
              'forma_pago': itm.get('forma_pago', 'contado'),
              'precio_esperado_gs': itm.get('precio_esperado', 0),
              'diferencia_gs': itm.get('precio',0) - itm.get('precio_esperado', itm.get('precio',0)),
              'margen_real_pct': itm.get('margen_real', 0),
              'profit_real_gs': itm.get('profit_real', 0),
              'alerta': itm.get('alerta', 'ok'),
              'stock_descontado': not es_sena,
              'stock_descontado_fecha': now if not es_sena else ''
            })

        num_pago = len(pagos) + 1
        pagos.append({
          'id_pago': f"PAG-{num_pago:04d}",
          'id_pedido': id_pedido,
          'fecha_pago': venta_data.get('fecha',''),
          'tipo': 'seña' if es_sena else 'contado_total',
          'monto_gs': venta_data.get('monto_sena', 0) if es_sena else venta_data.get('total',0),
          'forma_pago': venta_data.get('forma_pago', 'efectivo'),
          'nro_documento': venta_data.get('nro_factura', ''),
          'tipo_documento': venta_data.get('tipo_doc', 'factura_oficial'),
          'nro_factura': venta_data.get('nro_factura', ''),
          'conciliado': False,
          'fecha_conciliacion': '',
          'observaciones': venta_data.get('notas', '')
        })

        with open(pedidos_path, 'w', encoding='utf-8') as f: json.dump(pedidos, f, indent=2, ensure_ascii=False)
        with open(items_path, 'w', encoding='utf-8') as f: json.dump(items, f, indent=2, ensure_ascii=False)
        with open(pagos_path, 'w', encoding='utf-8') as f: json.dump(pagos, f, indent=2, ensure_ascii=False)
        return id_pedido

    def log_sales(sales_list, venta_data=None):
        if os.path.exists(SALES_FILE):
            try:
                df = pd.read_excel(SALES_FILE)
                df = pd.concat([df, pd.DataFrame(sales_list)], ignore_index=True)
            except Exception as e:
                st.error(f"Error al leer la planilla: {e}")
                return
        else:
            df = pd.DataFrame(sales_list)
        try:
            df['FECHA'] = pd.to_datetime(df['FECHA'], errors='coerce')
            writer = pd.ExcelWriter(SALES_FILE, engine='xlsxwriter')
            df.to_excel(writer, index=False, sheet_name='Ventas')
            workbook  = writer.book
            worksheet = writer.sheets['Ventas']
            date_format = workbook.add_format({'num_format': 'dd/mm/yyyy'})
            worksheet.set_column('A:A', 15, date_format)
            writer.close()
        except Exception as e:
            st.error(f"Error al guardar la planilla: {e}")
            
        if venta_data:
            registrar_pedido(venta_data)
            if venta_data.get('es_sena', False):
                reservar_stock(venta_data.get('items', []))
            else:
                descontar_stock(venta_data.get('items', []))
'''

content = re.sub(r'    def log_sales\(sales_list\):.*?    def get_next_invoice_number\(\):', new_log_sales + '\n    def get_next_invoice_number():', content, flags=re.DOTALL)

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Part 2 applied")
