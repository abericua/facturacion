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


# 3: Python script
py_file = 'Calculadora de precios solpro/calcular_precio_final.py'
py_code = '''import math
import json
import os

base_dir = os.path.dirname(__file__)
config_path = os.path.join(base_dir, 'config_solpro.json')

params = {
    "buffer_piso": 150,
    "margen_deseado_pct": 30.0,
    "comision_qr_pct": 4.0
}
if os.path.exists(config_path):
    with open(config_path, 'r') as f:
        config_data = json.load(f)
        params.update(config_data.get('parametros', {}))

def red_solpro_gs(precio):
    if precio <= 0: return 0
    if precio < 500000:
        return (math.ceil(precio / 10000) * 10000) - 1000
    else:
        return (math.ceil(precio / 100000) * 100000) - 10000

def red_solpro_usd(precio):
    if precio <= 0: return 0
    if precio < 100:
        return (math.ceil(precio / 10) * 10) - 1
    else:
        return (math.ceil(precio / 100) * 100) - 10

def calcular(costo, moneda='USD', margen_pct=None, linea='COMERCIAL', dolar_mercado=None):
    if dolar_mercado is None:
        dolar_mercado = 7350
        try:
            mtc_path = os.path.join(base_dir, '..', 'database', 'master_tipo_cambio.json')
            if os.path.exists(mtc_path):
                with open(mtc_path, 'r') as f:
                    mtc = json.load(f)
                    if mtc.get('dolar_mercado', 0) > 0:
                        dolar_mercado = mtc['dolar_mercado']
        except:
            pass

    if margen_pct is None:
        margen_pct = params.get('margen_deseado_pct', 30.0)
    
    buffer = params.get('buffer_piso', 150)
    banda_piso = dolar_mercado + buffer
    banda_techo = dolar_mercado + 350
    
    margen_decimal = margen_pct / 100
    if margen_decimal >= 1:
        return { 'precio_contado': 0, 'precio_qr': 0, 'precio_credito': None, 'credito_bloqueado': True, 'banda_piso': banda_piso, 'banda_techo': banda_techo, 'dolar_mercado': dolar_mercado }
    
    # Contado
    costo_gs_piso = costo * banda_piso if moneda.upper() == 'USD' else costo
    precio_mat_piso = costo_gs_piso / (1 - margen_decimal)
    p_contado = red_solpro_gs(precio_mat_piso)
    
    # QR
    p_qr = red_solpro_gs(p_contado / 0.96)
    
    # Credito
    if linea.upper() == 'COMERCIAL':
        p_credito = None
        credito_bloqueado = True
    else:
        costo_gs_techo = costo * banda_techo if moneda.upper() == 'USD' else costo
        precio_mat_techo = costo_gs_techo / (1 - margen_decimal)
        p_credito = red_solpro_gs(precio_mat_techo)
        credito_bloqueado = False
        
    return {
        'precio_contado': p_contado,
        'precio_qr': p_qr,
        'precio_credito': p_credito,
        'credito_bloqueado': credito_bloqueado,
        'banda_piso': banda_piso,
        'banda_techo': banda_techo,
        'dolar_mercado': dolar_mercado,
    }

if __name__ == "__main__":
    r = calcular(3991, 'USD', 23, 'INDUSTRIAL', dolar_mercado=7800)
    print("Contado:", r['precio_contado'])
    print("QR:", r['precio_qr'])
    print("Credito:", r['precio_credito'])
    print("Banda piso:", r['banda_piso'])
    print("Banda techo:", r['banda_techo'])
