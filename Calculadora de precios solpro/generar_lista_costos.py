import csv
import pandas as pd
import os

# Configuración de rutas
base_dir = r"C:\Users\solpr\Desktop\Calculadora de precios solpro"
file_maestros = os.path.join(base_dir, "productos_maestros.csv")
file_maestros2 = os.path.join(base_dir, "productos_maestros2.csv")
output_file = os.path.join(base_dir, "LISTA_DE_COSTOS_SOLPRO.xlsx")

def cargar_csv_robusto(path, sep=','):
    data = []
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        # Usamos csv.reader que maneja mejor las comillas
        reader = csv.reader(f, delimiter=sep, quotechar='"')
        header = next(reader)
        for row in reader:
            if len(row) >= 6:
                data.append(row[:7]) # Tomamos los primeros 7 campos
    return pd.DataFrame(data, columns=['Nombre', 'ID_Ref', 'Proveedor', 'Linea', 'Costo_Compra', 'Moneda_Costo', 'Margen_Pct'])

def cargar_productos():
    # Cargar productos individuales (con costos correctos)
    df_indiv = cargar_csv_robusto(file_maestros, sep=',')
    df_indiv['Costo_Compra'] = pd.to_numeric(df_indiv['Costo_Compra'], errors='coerce').fillna(0)
    
    # Cargar maestros 2 para obtener los combos
    df_m2 = cargar_csv_robusto(file_maestros2, sep=';')
    
    # Filtrar solo los combos de maestros2
    df_combos = df_m2[df_m2['ID_Ref'].str.startswith('CMB-', na=False)].copy()
    
    return df_indiv, df_combos

def calcular_costo_combo(nombre_combo, df_indiv):
    # Lógica similar a la del HTML: separar por '+'
    componentes = nombre_combo.replace('COMBO:', '').split('+')
    componentes = [c.strip().lower() for c in componentes]
    
    costo_usd = 0.0
    costo_gs = 0.0
    detalles = []
    
    for comp in componentes:
        # Buscar el producto que más se parezca por nombre (substring match)
        # Priorizamos coincidencias exactas o las más cortas que contengan el término
        matches = df_indiv[df_indiv['Nombre'].str.lower().str.contains(comp, regex=False)]
        
        if not matches.empty:
            # Si hay varias, intentamos buscar una que coincida mejor
            # Por simplicidad y consistencia con el JS original, tomamos la primera
            match = matches.iloc[0]
            if match['Moneda_Costo'] == 'USD':
                costo_usd += match['Costo_Compra']
            else:
                costo_gs += match['Costo_Compra']
            detalles.append(f"{match['Nombre']} ({match['Moneda_Costo']} {match['Costo_Compra']})")
        else:
            # Intento secundario: buscar por palabras clave si el nombre es complejo
            # (Ej: "LASER 10W" vs "GRABADORA LASER 10W")
            # Esto es un refinamiento de la lógica simple de JS
            palabras = comp.split()
            if len(palabras) > 1:
                for p in palabras:
                    if len(p) > 3: # Evitar palabras cortas
                        m = df_indiv[df_indiv['Nombre'].str.lower().str.contains(p, regex=False)]
                        if not m.empty:
                            match = m.iloc[0]
                            if match['Moneda_Costo'] == 'USD':
                                costo_usd += match['Costo_Compra']
                            else:
                                costo_gs += match['Costo_Compra']
                            detalles.append(f"{match['Nombre']} (aprox match) ({match['Moneda_Costo']} {match['Costo_Compra']})")
                            break
            else:
                detalles.append(f"NO ENCONTRADO: {comp}")
                
    return costo_usd, costo_gs, " + ".join(detalles)

def main():
    print("Cargando datos...")
    df_indiv, df_combos = cargar_productos()
    
    # Preparar lista final
    lista_final = []
    
    # Añadir productos individuales
    for _, row in df_indiv.iterrows():
        lista_final.append({
            'Código': row['ID_Ref'],
            'Producto': row['Nombre'],
            'Tipo': row['Linea'],
            'Costo USD': row['Costo_Compra'] if row['Moneda_Costo'] == 'USD' else 0,
            'Costo GS': row['Costo_Compra'] if row['Moneda_Costo'] == 'GS' else 0,
            'Moneda Original': row['Moneda_Costo'],
            'Componentes': 'Individual'
        })
    
    # Añadir combos calculados
    print("Calculando costos de combos...")
    for _, row in df_combos.iterrows():
        c_usd, c_gs, comp_str = calcular_costo_combo(row['Nombre'], df_indiv)
        lista_final.append({
            'Código': row['ID_Ref'],
            'Producto': row['Nombre'],
            'Tipo': 'COMBO',
            'Costo USD': c_usd,
            'Costo GS': c_gs,
            'Moneda Original': 'MIXTA/GS',
            'Componentes': comp_str
        })
        
    df_final = pd.DataFrame(lista_final)
    
    # Guardar a Excel
    print(f"Guardando en {output_file}...")
    try:
        df_final.to_excel(output_file, index=False)
        print("¡Listo! Archivo actualizado.")
    except PermissionError:
        alternative_file = output_file.replace(".xlsx", "_NUEVO.xlsx")
        df_final.to_excel(alternative_file, index=False)
        print(f"No se pudo sobreescribir {output_file} (posiblemente esté abierto).")
        print(f"Se ha guardado una copia en: {alternative_file}")
    except Exception as e:
        print(f"Error al guardar el archivo: {e}")

if __name__ == "__main__":
    main()
