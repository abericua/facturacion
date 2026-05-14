import os
import re
import json
import pandas as pd
try:
    import pypdf
except ImportError:
    try:
        import PyPDF2 as pypdf
    except ImportError:
        pypdf = None

# --- CONSTANTES DE RUTA SOLPRO ---
SGSP_ROOT = os.path.dirname(os.path.abspath(__file__))
DATABASE_DIR = os.path.join(SGSP_ROOT, "database")
HISTORICAL_FILE = os.path.join(DATABASE_DIR, "historical_summary.json")

def clean_val(val_str):
    """Limpia montos con puntos y comas de la SET"""
    try:
        # Eliminar puntos de miles y cambiar coma por punto decimal
        clean = val_str.replace(".", "").replace(",", ".")
        return float(clean)
    except:
        return 0.0

def parse_iva_120(text):
    """Extrae datos del Formulario 120 (Paraguay) con Regex robusto"""
    data = {}
    
    def get_casilla(num, txt):
        # Busca el número de casilla seguido de espacios y un monto con puntos
        # Ejemplo: "10 73.617.273" o "44 7.361.727"
        pattern = rf"\b{num}\s+([\d\.,]{{4,}})"
        matches = re.findall(pattern, txt)
        if matches:
            vals = [clean_val(m) for m in matches]
            return max(vals)
        return 0.0

    # Extraer campos clave
    data['ventas_brutas'] = get_casilla(18, text) or get_casilla(10, text)
    data['debito_fiscal'] = get_casilla(44, text) or get_casilla(24, text)
    data['credito_fiscal'] = get_casilla(45, text) or get_casilla(43, text)
    
    # Compras (Suma de bases imponibles Rubro 3)
    c32 = get_casilla(32, text)
    c35 = get_casilla(35, text)
    data['compras_netas'] = c32 + c35
    
    # Periodo (Mes/Año)
    # Patrón: Mes Año 0 4 2 0 2 4
    periodo_match = re.search(r"Mes\s+A[nñ]o\s+([\d\s]{5,15})", text)
    if periodo_match:
        digits = periodo_match.group(1).replace(" ","").strip().zfill(6)
        if len(digits) >= 6:
            data['mes'] = digits[:2]
            data['anio'] = digits[2:6]
    
    return data

def scan_historical_archives():
    base_path = os.path.join(SGSP_ROOT, "IIVAS Y DOCUMENTOS LEGALES SOLPRO")
    if not os.path.exists(base_path):
        print(f"❌ Error: No existe la carpeta: {base_path}")
        return []
    
    historical_results = []
    print(f"🔍 Iniciando escaneo profundo en: {base_path}...")
    
    for root, dirs, files in os.walk(base_path):
        for file in files:
            if file.lower().endswith(".pdf"):
                path = os.path.join(root, file)
                try:
                    reader = pypdf.PdfReader(path)
                    text = ""
                    for page in reader.pages:
                        text += page.extract_text() + "\n"
                    
                    if "120" in text and ("VALOR AGREGADO" in text or "ENAJENACION" in text):
                        res = parse_iva_120(text)
                        if res.get('ventas_brutas', 0) > 0:
                            res['archivo'] = file
                            historical_results.append(res)
                            print(f"✅ [OK] {file} -> Ventas: GS {res['ventas_brutas']:,.0f} ({res.get('mes')}/{res.get('anio')})")
                except Exception as e:
                    pass # Silenciar errores de archivos corruptos
    
    return historical_results

if __name__ == "__main__":
    print("==========================================")
    print("🏛️  SOLPRO - INTELIGENCIA HISTÓRICA v2.0")
    print("==========================================\n")
    
    if pypdf is None:
        print("❌ Error: Falta pypdf. Instale con: pip install pypdf")
    else:
        results = scan_historical_archives()
        if results:
            if not os.path.exists(DATABASE_DIR): os.makedirs(DATABASE_DIR)
            # Guardar resultados
            with open(HISTORICAL_FILE, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=4, ensure_ascii=False)
            
            print(f"\n🚀 ¡ESCANEÓ COMPLETADO! {len(results)} meses recuperados.")
            
            df = pd.DataFrame(results)
            if 'anio' in df.columns:
                print("\n📊 Resumen Histórico Facturado (IVA):")
                summary = df.groupby('anio')['ventas_brutas'].sum()
                for anio, monto in summary.items():
                    print(f"   * {anio}: GS {monto:,.0f}")
        else:
            print("⚠️ No se detectaron declaraciones juradas válidas.")

    print("\n==========================================")
    input("Presiona ENTER para finalizar...")
