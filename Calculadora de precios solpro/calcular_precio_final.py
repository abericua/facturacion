import math
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
        dolar_mercado = 6250
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
