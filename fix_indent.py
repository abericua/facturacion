import os
import re

file_path = r"main_portal.py"
if not os.path.exists(file_path):
    file_path = r"C:\Users\beric\OneDrive\Desktop\SGSP\main_portal.py"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Buscar el bloque que empieza con with tab_brain: y termina antes de elif current_page == "calculadora"
pattern = r"(            with tab_brain:)\n(            # --- 3D IMMERSIVE EXPERIENCE.*?)(?=    elif st\.session_state\.current_page == \"calculadora\":)"
def indent_match(m):
    header = m.group(1)
    body = m.group(2)
    # Indentar cada línea del cuerpo con 4 espacios extra
    indented_body = "\n".join(["    " + line if line.strip() else line for line in body.split("\n")])
    return header + "\n" + indented_body

new_content = re.sub(pattern, indent_match, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Indentación corregida.")
