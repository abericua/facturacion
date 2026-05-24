import json
import re
import math
import os

with open('database/solpro_pricing.js', 'r', encoding='utf-8') as f:
    pricing_js = f.read()

pricing_js_clean = pricing_js.replace('module.exports = {', 'return {')
pricing_js_clean = pricing_js_clean.replace('};', '}')

html_file = 'Calculadora de precios solpro/calculadora_precios.html'
with open(html_file, 'r', encoding='utf-8') as f:
    html = f.read()

# 2A: Inject SolproPricing
mod_str = f'''// ═══════════════════════════════════════
// SOLPRO PRICING ENGINE v1.0.0
// Fuente: database/solpro_pricing.js
// NO editar aquí — editar en solpro_pricing.js
// y sincronizar manualmente.
// ═══════════════════════════════════════
const SolproPricing = (() => {{
{pricing_js_clean}
}})();
'''

if 'const SolproPricing =' not in html:
    html = html.replace("'use strict';", "'use strict';\n" + mod_str)


# 2B: Replace calculateAll
old_calc_all_start = html.find('function calculateAll() {')
old_calc_all_end = html.find('function renderTable() {', old_calc_all_start)

new_calc_all = '''function calculateAll() {
            const dolar = parseFloat(document.getElementById('p_dolar').value) || 6250;
            const bufferP = parseFloat(document.getElementById('p_buffer').value) || 0;
            
            const bandas = SolproPricing.calcularBandas(dolar);
            const bandaPiso = dolar + bufferP;
            const bandaTecho = bandas.bandaTecho;
            
            document.getElementById('p_banda').value = `Gs. ${bandaPiso.toLocaleString('es-PY')}`;
            
            const lblPiso = document.getElementById('lbl_banda_piso');
            const lblTecho = document.getElementById('lbl_banda_techo');
            if(lblPiso) lblPiso.innerText = `🟢 Banda Piso: Gs ${bandaPiso.toLocaleString('es-PY')} (Contado / QR)`;
            if(lblTecho) lblTecho.innerText = `🔵 Banda Techo: Gs ${bandaTecho.toLocaleString('es-PY')} (Crédito Industrial)`;

            db.forEach(p => {
                const mPct = p.margen / 100;
                const isCombo = p.id.startsWith('CMB') || p.linea.includes('COMBO');
                
                let costoBase = p.costo;
                if (isCombo && costoBase === 0) {
                    costoBase = autoCalcComboCosto(p, bandaPiso);
                }
                p.costoCalculado = p.moneda === 'USD' ? costoBase * bandaPiso : costoBase;
                
                p.vC = SolproPricing.calcularPrecioContado(costoBase, p.moneda, p.margen, bandaPiso);
                p.vQ = SolproPricing.calcularPrecioQR(p.vC);
                p.vMSRP = p.costoCalculado / 0.64;
                p.profit = p.vC - p.costoCalculado;
                p.mon = 'GS';
                
                const resultCred = SolproPricing.calcularPrecioCredito(costoBase, p.moneda, p.margen, bandaTecho, p.linea);
                p.creditoBloqueado = resultCred.bloqueado;
                p.vCr = resultCred.bloqueado ? null : resultCred.precio;
            });
            renderTable();
        }

        '''
html = html[:old_calc_all_start] + new_calc_all + html[old_calc_all_end:]


# Remove old redGs and redUsd
html = re.sub(r'const redGs\s*=.*?\n', '', html)
html = re.sub(r'const redUsd\s*=.*?\n', '', html)

# 2C: UI Table headers and rows
if '<th>Precio Crédito</th>' not in html:
    html = html.replace('<th>Precio Contado</th>', '<th>Precio Crédito</th>\n                                <th>Precio Contado</th>')
    
# Row replacement
tr_find = '''<td><span class="price-col ${p.mon === 'USD' ? 'usd-color' : 'gs-color'}">${sym} ${p.vC.toLocaleString('es-PY')}</span></td>'''
tr_rep = '''<td>${p.creditoBloqueado ? '<span class="badge" style="background:rgba(231, 76, 60, 0.1); color:var(--danger);">SOLO CONTADO/QR</span>' : '<div style="display:flex; flex-direction:column;"><span class="price-col" style="color:var(--text-main);">${sym} ' + p.vCr.toLocaleString('es-PY') + '</span><span style="font-size:0.5rem; color:var(--text-muted); text-transform:uppercase;">Crédito (Banda Techo)</span></div>'}</td>
                        <td><span class="price-col ${p.mon === 'USD' ? 'usd-color' : 'gs-color'}">${sym} ${p.vC.toLocaleString('es-PY')}</span></td>'''
if 'p.creditoBloqueado' not in html:
    html = html.replace(tr_find, tr_rep)


# 2D: Bandas in params
bandas_html = '''<div id="bandas_display" style="margin-top:10px; font-size:0.75rem; color:var(--text-muted); font-weight:700; background:rgba(0,0,0,0.2); padding:10px; border-radius:10px; border:1px solid var(--card-border);">
                            <div id="lbl_banda_piso">🟢 Banda Piso: -</div>
                            <div id="lbl_banda_techo" style="margin-top:5px;">🔵 Banda Techo: -</div>
                        </div>'''
if 'bandas_display' not in html:
    html = html.replace('<input type="number" id="p_buffer" value="0" oninput="calculateAll()">', '<input type="number" id="p_buffer" value="0" oninput="calculateAll()">\n                            ' + bandas_html)


# 2E: Load master_tipo_cambio.json
init_find = '''document.addEventListener('DOMContentLoaded', () => {'''
init_rep = '''document.addEventListener('DOMContentLoaded', async () => {
            try {
                const res = await fetch('../database/master_tipo_cambio.json');
                const tc = await res.json();
                if (tc && tc.dolar_mercado > 0) {
                    document.getElementById('p_dolar').value = tc.dolar_mercado;
                }
            } catch (e) {
                console.log('No se pudo cargar master_tipo_cambio.json, usando defaults.');
            }
'''
if "fetch('../database/master_tipo_cambio.json')" not in html:
    html = html.replace(init_find, init_rep)


with open(html_file, 'w', encoding='utf-8') as f:
    f.write(html)
