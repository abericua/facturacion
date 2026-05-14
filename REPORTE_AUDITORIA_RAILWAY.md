# 🔍 AUDITORÍA COMPLETA — SOLPRO Creador de Facturas
## Por qué Antigravity no puede ejecutar ningún deploy en Railway

**Fecha:** 14/05/2026  
**Proyecto auditado:** `Creador de Facturas/`  
**Stack:** Python 3.10 · Streamlit · ReportLab · Railway (Docker)

---

## ❌ CAUSA RAÍZ: 3 variables indefinidas bloquean el arranque

Este es el bug más grave y es suficiente para que Railway rechace **cualquier deploy**. En `app.py`, líneas 227–233, el código referencia tres variables que **nunca se definen en ninguna parte del archivo**:

```python
# app.py — línea 227
DATA_DIR = PERSISTENT_DIR if os.path.exists(PERSISTENT_DIR) else BASE_DIR

PRODUCTS_FILE = os.path.join(SGSP_DATABASE, "productos_maestros.csv")
SALES_FILE    = os.path.join(SGSP_DATABASE, "VENTAS TOTALES 2026.xlsx")
CLIENTS_FILE  = os.path.join(SGSP_DATABASE, "clientes.json")
USERS_FILE    = os.path.join(SGSP_DATABASE, "usuarios.json")
OUTPUT_DIR    = os.path.join(DATA_DIR, "Facturas_Emitidas")
```

Las variables `PERSISTENT_DIR`, `BASE_DIR` y `SGSP_DATABASE` **no existen en el script**.  
Python lanza `NameError: name 'PERSISTENT_DIR' is not defined` y el proceso muere antes de que Streamlit pueda iniciar.  
Railway ve el proceso salir con código de error → marca el deploy como **fallido**.

### ✅ Fix — Agregar al inicio de `app.py` (después de los imports):

```python
import os

BASE_DIR       = os.path.dirname(os.path.abspath(__file__))
PERSISTENT_DIR = "/data"          # Ruta del volumen persistente en Railway
SGSP_DATABASE  = PERSISTENT_DIR if os.path.exists(PERSISTENT_DIR) else BASE_DIR
```

---

## 🐳 Bug #2 — `dockerfilePath` con barra inicial incorrecta

En `railway.json`:

```json
"build": {
  "builder": "DOCKERFILE",
  "dockerfilePath": "/Dockerfile"   ← ¡INCORRECTO!
}
```

La barra al inicio hace que Railway busque `/Dockerfile` como ruta **absoluta del sistema de archivos del builder**, no relativa al proyecto. El Dockerfile nunca se encuentra.

### ✅ Fix — `railway.json`:

```json
"dockerfilePath": "Dockerfile"
```

---

## 🗃️ Bug #3 — `pd.read_excel()` sobre un archivo `.csv`

```python
PRODUCTS_FILE = os.path.join(SGSP_DATABASE, "productos_maestros.csv")
# ...
df = pd.read_excel(PRODUCTS_FILE)   ← read_excel con extensión .csv lanza error
```

`pandas.read_excel()` espera un archivo `.xlsx` o `.xls`. Pasarle un path `.csv` genera:  
`xlrd.biffh.XLRDError: Unsupported format, or corrupt file`

### ✅ Fix — Cambiar la extensión o usar el lector correcto:

Opción A (si el archivo es realmente Excel):
```python
PRODUCTS_FILE = os.path.join(SGSP_DATABASE, "productos_maestros.xlsx")
```

Opción B (si es CSV real):
```python
df = pd.read_csv(PRODUCTS_FILE)
```

---

## 🧩 Bug #4 — `st.set_page_config()` dentro de `main()` que nunca se llama

```python
def main():
    if __name__ == "__main__":
        st.set_page_config(...)   # ← Nunca se ejecuta

# A nivel módulo (línea 26):
st.markdown("""...""", unsafe_allow_html=True)  # ← Esto sí corre
```

`main()` se define pero **nunca se invoca**. Streamlit ejecuta el módulo directamente; el `if __name__ == "__main__"` dentro de `main()` siempre es `False` en ese contexto. La página arranca sin título ni layout configurado.

### ✅ Fix — Mover `set_page_config` al nivel raíz del script, como primera llamada Streamlit:

```python
# Al inicio del archivo, ANTES de cualquier st.*
st.set_page_config(
    page_title="SOLPRO - Facturación Corporativa",
    layout="wide",
    page_icon="📄",
    initial_sidebar_state="expanded"
)
```

Y eliminar la función `main()` vacía.

---

## 💾 Problema de arquitectura — Sin volumen persistente

El app escribe datos en disco:
- `VENTAS TOTALES 2026.xlsx` (historial de ventas)
- `clientes.json` (base de clientes)
- `Facturas_Emitidas/*.pdf` (PDFs generados)

En Railway, el filesystem de un contenedor Docker es **efímero**: se borra completamente en cada redeploy.  
**Cada deploy resetea toda la base de datos.**

### ✅ Fix — Configurar un volumen persistente en Railway:

1. En el dashboard de Railway: **Settings → Volumes → Add Volume**
2. Mount path: `/data`
3. En `app.py` (con el fix del Bug #1 ya aplicado), los archivos se guardarán en `/data` automáticamente.
4. Para el primer arranque, copiar los archivos iniciales si el volumen está vacío:

```python
import shutil

if DATA_DIR != BASE_DIR:
    for f in ["clientes.json", "usuarios.json"]:
        dest = os.path.join(DATA_DIR, f)
        src  = os.path.join(BASE_DIR, f)
        if not os.path.exists(dest) and os.path.exists(src):
            shutil.copy2(src, dest)
```

*(Esta lógica ya existe parcialmente en el código pero depende del Bug #1 estar resuelto.)*

---

## 🔒 Alertas de Seguridad

### ⚠️ ALTA — Hashes de contraseñas en el repositorio Git

`usuarios.json` está trackeado en git y contiene los hashes SHA-256 de las contraseñas de todos los usuarios, incluyendo el admin. Cualquiera con acceso al repositorio puede intentar ataques de diccionario.

**Acción recomendada:**
1. Eliminar `usuarios.json` del historial de git: `git rm --cached usuarios.json`
2. Agregar `usuarios.json` al `.gitignore`
3. Manejar el archivo de usuarios solo en el volumen persistente

### ⚠️ ALTA — Archivo de contraseñas en texto plano

`PerfilUsuarioContraseña.txt` existe en el repositorio y contiene contraseñas en texto plano. **Eliminarlo inmediatamente del repositorio y del historial git.**

### ⚠️ MEDIA — Pepper de seguridad hardcodeado

```python
SYSTEM_PEPPER = "SOLPRO_ULTRA_SECRET_2026_#!"  # app.py línea 281
```

Este valor debería ser una variable de entorno de Railway, nunca hardcodeado en el código fuente.

**Fix:**
```python
SYSTEM_PEPPER = os.environ.get("SYSTEM_PEPPER", "fallback_solo_local")
```
Y configurarlo como variable de entorno en Railway: `Settings → Variables → Add Variable`.

---

## 📦 `.dockerignore` — Archivos innecesarios en la imagen

El `Dockerfile` usa `COPY . .` pero el `.dockerignore` no excluye:
- Archivos PNG (logos de alta resolución)
- Carpeta `scratch/` (scripts de desarrollo)
- Archivos `.bat` (solo útiles en Windows)
- La carpeta `Facturas_Emitidas/` con PDFs

Esto infla el tamaño de la imagen Docker y ralentiza los builds.

### ✅ Fix — Agregar al `.dockerignore`:

```
scratch/
*.bat
*.txt
*.png
*.jpg
Facturas_Emitidas/
LOGO*.png
factura*.png
ISOLOGO*.png
```

---

## 📋 Resumen ejecutivo de problemas

| # | Severidad | Problema | Impacto |
|---|-----------|----------|---------|
| 1 | 🔴 CRÍTICO | `PERSISTENT_DIR`, `BASE_DIR`, `SGSP_DATABASE` no definidas | App no inicia — deploy siempre falla |
| 2 | 🔴 CRÍTICO | `dockerfilePath: "/Dockerfile"` con barra inicial | Dockerfile no encontrado — build falla |
| 3 | 🟠 ALTO | `pd.read_excel()` sobre path `.csv` | Crash al cargar productos |
| 4 | 🟠 ALTO | Sin volumen persistente en Railway | Datos se pierden en cada deploy |
| 5 | 🟡 MEDIO | `st.set_page_config()` nunca se ejecuta | Sin título ni layout configurado |
| 6 | 🔴 CRÍTICO (seguridad) | `usuarios.json` con hashes en git | Exposición de credenciales |
| 7 | 🔴 CRÍTICO (seguridad) | `PerfilUsuarioContraseña.txt` en git | Contraseñas en texto plano expuestas |
| 8 | 🟡 MEDIO (seguridad) | `SYSTEM_PEPPER` hardcodeado | Seguridad por oscuridad |
| 9 | 🟢 BAJO | Imagen Docker inflada | Builds lentos |

---

## 🛠️ Plan de acción — orden recomendado

1. **Agregar las 3 variables** al inicio de `app.py` (Fix Bug #1) → desbloquea todos los deploys
2. **Corregir `railway.json`** quitando la barra de `dockerfilePath` (Fix Bug #2)
3. **Corregir extensión** de `PRODUCTS_FILE` (Fix Bug #3)
4. **Configurar volumen `/data`** en Railway Dashboard
5. **Mover `st.set_page_config()`** al nivel raíz del script
6. **Eliminar archivos sensibles** del repositorio git (usuarios.json, PerfilUsuarioContraseña.txt)
7. **Mover `SYSTEM_PEPPER`** a variable de entorno en Railway

Con los fixes 1 y 2 aplicados, el primer deploy exitoso debería ocurrir.

---

*Auditoría generada automáticamente por Claude (Cowork) — SOLPRO Internal*
