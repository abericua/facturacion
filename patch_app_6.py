import os
import re
from datetime import datetime

app_path = r'c:\Users\beric\OneDrive\Desktop\SGSP\Creador de Facturas\app.py'

with open(app_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_logic = '''            tipo_venta = st.radio("Tipo de venta", ["Contado / Entrega inmediata", "Seña / Pago parcial"], horizontal=True)
            monto_sena = 0
            tipo_doc_sena = "Factura oficial"
            if tipo_venta == "Seña / Pago parcial":
                monto_sena = st.number_input("Monto de la seña (Gs)", min_value=0, value=int(total_factura*0.3) if total_factura > 0 else 0)
                tipo_doc_sena = st.radio("Documento a emitir por la seña", ["Recibo interno", "Factura oficial con leyenda PAGO PARCIAL"], horizontal=True)
                st.info(f"Saldo pendiente: Gs {total_factura - monto_sena:,.0f} | Stock: Será reservado (no descontado)")

            if 'invoice_generated' in st.session_state:
                st.success(f"Documento {st.session_state.invoice_nro} emitido")
                try:
                    with open(st.session_state.invoice_pdf_path, "rb") as f: 
                        st.download_button("📥 DESCARGAR PDF", f, os.path.basename(st.session_state.invoice_pdf_path), "application/pdf", key="dl_btn_after_gen")
                except Exception: pass

            if st.button("⚡ GENERAR Y REGISTRAR"):
                if not nombre or not st.session_state.factura_items: st.error("Faltan datos")
                else:
                    with st.spinner("Procesando..."):
                        inventory_log = []
                        descripciones = []
                        codigos = []
                        items_for_venta = []
                        for it in st.session_state.factura_items:
                            descripciones.append(f"{it['cant']} {it['desc']}")
                            if it.get('codigo'): codigos.append(str(it['codigo']))
                            inventory_log.append({
                                "COD_PRODUCTO": it.get('codigo', ''),
                                "_CANT_NUM": it['cant']
                            })
                            items_for_venta.append({
                                'id_solpro': it.get('id_solpro', ''),
                                'id_producto_solpro': it.get('id_solpro', ''),
                                'descripcion': it['desc'],
                                'cantidad': it['cant'],
                                'precio': it['precio'],
                                'costo': it.get('costo', 0),
                                'margen_pct': it.get('margen_pct', 0),
                                'moneda': it.get('moneda', 'GS')
                            })

                        es_sena = (tipo_venta == "Seña / Pago parcial")
                        if not es_sena:
                            is_valid, error_msg = validate_stock(inventory_log)
                            if not is_valid:
                                st.error(error_msg)
                                st.stop()

                        save_client({"nombre": nombre, "ruc": ruc, "direccion": direccion, "telefono": telefono})
                        
                        fecha_str_pdf = fecha_emision.strftime("%d/%m/%Y")
                        fecha_str_file = fecha_emision.strftime("%Y%m%d")
                        
                        doc_num = nro_factura
                        if es_sena and tipo_doc_sena == "Recibo interno":
                            from datetime import datetime
                            doc_num = f"REC-{str(int(datetime.now().timestamp()))[-5:]}"

                        pdf_path = os.path.join(OUTPUT_DIR, f"Doc_{doc_num}_{fecha_str_file}.pdf")
                        
                        pdf_data = {
                            "nro_factura": doc_num, "fecha": fecha_str_pdf,
                            "nombre": nombre, "ruc": ruc, "direccion": direccion, "telefono": telefono,
                            "condicion": condicion, "moneda": moneda,
                            "productos": [{"c": it['cant'], "d": it['desc'], "p": it['precio'], "t": it['total']} for it in st.session_state.factura_items]
                        }
                        if es_sena:
                            pdf_data["leyenda_extra"] = f"PAGO PARCIAL - Seña recibida: Gs {monto_sena:,.0f} | Saldo: Gs {total_factura - monto_sena:,.0f}"

                        generate_invoice_pdf(pdf_data, pdf_path)

                        import json
                        sales_log = [{
                            "FECHA": fecha_emision,
                            "DESCRIPCION": ", ".join(descripciones),
                            "CLIENTE": nombre,
                            "PRECIO GS": total_factura if moneda == "PYG" else None,
                            "PRECIO USD": total_factura if moneda == "USD" else None,
                            "NRO_FACTURA": doc_num,
                            "VENDEDOR": vendedor,
                            "FORMA PAGO": condicion,
                            "COD_PRODUCTO": ", ".join(codigos),
                            "LINEA": "CORP",
                            "RAW_ITEMS": json.dumps(inventory_log)
                        }]

                        venta_data = {
                            'es_sena': es_sena,
                            'monto_sena': monto_sena,
                            'tipo_doc': tipo_doc_sena if es_sena else 'factura_oficial',
                            'cliente': nombre,
                            'id_cliente_solpro': sel_data.get('id_solpro', '') if sel_data else '',
                            'ruc': ruc,
                            'fecha': fecha_emision.isoformat(),
                            'vendedor': vendedor,
                            'total': total_factura,
                            'forma_pago': condicion,
                            'nro_factura': doc_num,
                            'items': items_for_venta
                        }

                        log_sales(sales_log, venta_data)

                        st.session_state.invoice_generated = True
                        st.session_state.invoice_nro = doc_num
                        st.session_state.invoice_pdf_path = pdf_path
                        st.session_state.factura_items = [{"cant": 1, "desc": "", "precio": 0.0, "codigo": ""}]
                        st.rerun()'''

pattern = re.compile(r'            if \'invoice_generated\' in st\.session_state:.*?st\.rerun\(\)', re.DOTALL)
content = pattern.sub(new_logic, content)

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Part 6 applied")
