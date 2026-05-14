import re
import csv
import os

# Configuración de archivos
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_FILE = os.path.join(BASE_DIR, 'productos_maestros.csv')
HTML_FILE = os.path.join(BASE_DIR, 'calculadora_precios.html')

def actualizar():
    print("🚀 Iniciando actualización automática de Solpro Pricing Engine...")
    
    if not os.path.exists(CSV_FILE):
        print(f"❌ Error: No se encuentra el archivo {CSV_FILE}")
        return

    # 1. Leer el CSV y formatearlo para JS (String Multilínea)
    # Formato esperado en HTML: ID,NOMBRE,LINEA,COSTO,MONEDA
    rows = []
    try:
        with open(CSV_FILE, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            # Normalizar nombres de columnas si es necesario
            # Esperamos: ID_Ref, Nombre, Linea, Costo_Compra, Moneda_Costo
            for row in reader:
                id_ref = row.get('ID_Ref', '').strip()
                nombre = row.get('Nombre', '').strip()
                linea = row.get('Linea', '').strip()
                costo = row.get('Costo_Compra', '0').strip()
                moneda = row.get('Moneda_Costo', 'GS').strip()
                
                if not id_ref or not nombre: continue
                
                rows.append(f"{id_ref},{nombre},{linea},{costo},{moneda}")
    except Exception as e:
        print(f"❌ Error leyendo el CSV: {e}")
        return

    master_data_content = "\n".join(rows)
    
    # 2. Leer el HTML
    with open(HTML_FILE, 'r', encoding='utf-8') as f:
        html_content = f.read()

    # 3. Reemplazar el bloque MASTER_DATA
    # Buscamos const MASTER_DATA = `...`;
    pattern = r'(const MASTER_DATA = `).*?(`;)'
    new_data_block = f'const MASTER_DATA = `\n{master_data_content}`;'
    
    if not re.search(pattern, html_content, re.DOTALL):
        print("❌ Error: No se encontró el bloque MASTER_DATA (backticks) en el HTML.")
        return
        
    html_content = re.sub(pattern, new_data_block, html_content, flags=re.DOTALL)

    # 4. Incrementar la versión automáticamente
    def increment_version(match):
        version_str = match.group(1)
        version_num = int(re.search(r'\d+', version_str).group())
        return f"const DB_KEY = 'solpro_db_v{version_num + 1}';"

    html_content = re.sub(r"const DB_KEY = '(solpro_db_v\d+)';", increment_version, html_content)

    # 5. Guardar cambios
    with open(HTML_FILE, 'w', encoding='utf-8') as f:
        f.write(html_content)

    print(f"✅ ¡Éxito! Se sincronizaron {len(rows)} productos.")
    print("✅ La versión de la base de datos ha sido incrementada.")

if __name__ == "__main__":
    actualizar()
