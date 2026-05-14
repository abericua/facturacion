import math
import json
import os

# Cargar configuración centralizada
base_dir = os.path.dirname(__file__)
config_path = os.path.join(base_dir, 'config_solpro.json')

if os.path.exists(config_path):
    with open(config_path, 'r') as f:
        config_data = json.load(f)
        params = config_data.get('parametros', {})
else:
    params = {
        "buffer_piso": 150,
        "margen_deseado_pct": 30.0,
        "comision_qr_pct": 4.0
    }

def red_solpro(precio):
    """
    Regla v7: Redondear hacia arriba al múltiplo de 10.000 y restar 1.000.
    Ejemplo: 342.000 -> 350.000 -> 349.000
    """
    if precio <= 0: return 0
    return (math.ceil(precio / 10000) * 10000) - 1000

def calcular_precios(costo, moneda='USD', dolar_mercado=7350, margen_pct=None):
    """
    Calcula precio Contado y QR siguiendo la lógica del Sistema Solpro v7.
    """
    if margen_pct is None:
        margen_pct = params.get('margen_deseado_pct', 30.0)
    
    buffer = params.get('buffer_piso', 150)
    banda_piso = dolar_mercado + buffer
    
    # 1. Convertir a GS
    costo_gs = costo * banda_piso if moneda.upper() == 'USD' else costo
    
    # 2. Markup: Precio = Costo / (1 - Margen)
    margen_decimal = margen_pct / 100
    if margen_decimal >= 1: return 0, 0
    
    precio_matematico = costo_gs / (1 - margen_decimal)
    
    # 3. Redondeo Contado
    p_contado = red_solpro(precio_matematico)
    
    # 4. QR (+4% comision sobre el final) -> p_contado / 0.96
    comision_qr = params.get('comision_qr_pct', 4.0) / 100
    p_qr = red_solpro(p_contado / (1 - comision_qr))
    
    return p_contado, p_qr

if __name__ == "__main__":
    print(f"--- Motor de Cálculo Solpro v7 (Ajustado) ---")
    dolar = 7400
    costo_test = 145
    contado, qr = calcular_precios(costo_test, 'USD', dolar)
    
    print(f"Test USD {costo_test} (Dólar {dolar}):")
    print(f" > Contado: {contado:,} Gs.")
    print(f" > QR:      {qr:,} Gs.")
