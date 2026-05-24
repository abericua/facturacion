import os
import re

app_path = r'c:\Users\beric\OneDrive\Desktop\SGSP\Creador de Facturas\app.py'

with open(app_path, 'r', encoding='utf-8') as f:
    content = f.read()

tab6_logic = '''    if True:
        with tab6:
            st.header("📦 PEDIDOS PENDIENTES")
            pedidos_path = os.path.join(BASE_DIR, '..', 'database', 'pedidos.json')
            if os.path.exists(pedidos_path):
                import json
                with open(pedidos_path, 'r', encoding='utf-8') as f:
                    pedidos_all = json.load(f)
                
                pedidos_pendientes = [p for p in pedidos_all if p.get('estado') in ['señado', 'reservado']]
                
                if not pedidos_pendientes:
                    st.info("No hay pedidos pendientes.")
                else:
                    for p in pedidos_pendientes:
                        st.markdown(f"### {p['id_pedido']} - {p['nombre_cliente_factura']}")
                        st.write(f"**Fecha:** {p['fecha_pedido']} | **Vendedor:** {p['vendedor']}")
                        st.write(f"**Total:** Gs {p['precio_total_gs']:,.0f} | **Señado:** Gs {p.get('monto_señado_gs',0):,.0f} | **Saldo:** Gs {p.get('saldo_pendiente_gs',0):,.0f}")
                        
                        if st.button(f"✅ Registrar entrega y liquidar saldo", key=f"liq_{p['id_pedido']}"):
                            st.session_state.liquidar_pedido = p
                            st.rerun()

                    if 'liquidar_pedido' in st.session_state:
                        p_liq = st.session_state.liquidar_pedido
                        st.divider()
                        st.subheader(f"Liquidando saldo de {p_liq['id_pedido']}")
                        with st.form("form_liquidar"):
                            saldo_cobrado = st.number_input("Saldo cobrado", value=int(p_liq.get('saldo_pendiente_gs',0)))
                            forma_pago_liq = st.radio("Forma de Pago", ["CONTADO", "TRANSFERENCIA", "TARJETA"])
                            if st.form_submit_button("Confirmar Entrega y Factura Final"):
                                p_liq['estado'] = 'entregado'
                                p_liq['saldo_pendiente_gs'] = max(0, p_liq.get('saldo_pendiente_gs',0) - saldo_cobrado)
                                p_liq['monto_señado_gs'] = p_liq.get('monto_señado_gs',0) + saldo_cobrado
                                p_liq['nro_factura_final'] = get_next_invoice_number()

                                with open(pedidos_path, 'w', encoding='utf-8') as f:
                                    json.dump(pedidos_all, f, indent=2, ensure_ascii=False)

                                items_path = os.path.join(BASE_DIR, '..', 'database', 'pedido_items.json')
                                items_all = []
                                if os.path.exists(items_path):
                                    with open(items_path, 'r', encoding='utf-8') as f: items_all = json.load(f)
                                items_del_pedido = [i for i in items_all if i['id_pedido'] == p_liq['id_pedido']]
                                descontar_stock(items_del_pedido)

                                pagos_path = os.path.join(BASE_DIR, '..', 'database', 'pagos.json')
                                pagos_all = []
                                if os.path.exists(pagos_path):
                                    with open(pagos_path, 'r', encoding='utf-8') as f: pagos_all = json.load(f)
                                from datetime import datetime
                                pagos_all.append({
                                    'id_pago': f"PAG-{len(pagos_all)+1:04d}",
                                    'id_pedido': p_liq['id_pedido'],
                                    'fecha_pago': datetime.now().isoformat(),
                                    'tipo': 'saldo_final',
                                    'monto_gs': saldo_cobrado,
                                    'forma_pago': forma_pago_liq,
                                    'nro_documento': p_liq['nro_factura_final']
                                })
                                with open(pagos_path, 'w', encoding='utf-8') as f:
                                    json.dump(pagos_all, f, indent=2, ensure_ascii=False)

                                st.success("Pedido liquidado y stock actualizado.")
                                del st.session_state.liquidar_pedido
                                st.rerun()
            else:
                st.info("No hay base de pedidos inicializada.")

if __name__ == "__main__":
'''

content = content.replace('if __name__ == "__main__":', tab6_logic)

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Part 7 applied")
