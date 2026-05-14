import docx
import os

file_path = "MANUAL DE POLÍTICA DE PRECIOS Y BLINDAJE FINANCIERO.docx"

if os.path.exists(file_path):
    doc = docx.Document(file_path)
    full_text = []
    for para in doc.paragraphs:
        full_text.append(para.text)
    print("\n".join(full_text))
else:
    print(f"File {file_path} not found.")
