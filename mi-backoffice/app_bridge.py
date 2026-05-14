import os
import json
import requests
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Configuración
OLLAMA_URL = "http://localhost:11434/api/generate"
DEFAULT_MODEL = "gemma4:26b"  # Nombre exacto detectado en tu sistema
PROJECT_PATH = os.path.dirname(os.path.abspath(__file__))
BITACORA_PATH = os.path.join(PROJECT_PATH, "BITACORA_SOLPRO.md")

def get_bitacora_context():
    if os.path.exists(BITACORA_PATH):
        with open(BITACORA_PATH, "r", encoding="utf-8") as f:
            return f.read()[:2000]  # Tomamos los primeros 2000 caracteres para contexto
    return "No se encontró la bitácora."

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/models', methods=['GET'])
def get_models():
    try:
        response = requests.get("http://localhost:11434/api/tags")
        if response.status_code == 200:
            models = [m['name'] for m in response.json().get('models', [])]
            return jsonify({"success": True, "models": models})
        return jsonify({"success": False, "error": "No se pudo conectar con Ollama"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/review', methods=['POST'])
def review_code():
    data = request.json
    code = data.get('code', '')
    model = data.get('model', DEFAULT_MODEL)
    context = get_bitacora_context()

    prompt = f"""
    Eres Gemma, el 'Cerebro de Revisión' para el proyecto Sol Pro Backoffice.
    Contexto del proyecto:
    {context}

    TAREA: Revisa el siguiente código generado por Antigravity (Gemini).
    Busca errores de lógica, seguridad o falta de coherencia con el resto del sistema Sol Pro.
    Sé breve y directo.

    CÓDIGO A REVISAR:
    {code}
    """

    try:
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False
        }
        response = requests.post(OLLAMA_URL, json=payload)
        if response.status_code == 200:
            return jsonify({"success": True, "review": response.json().get('response', '')})
        return jsonify({"success": False, "error": "Error en la respuesta de Ollama"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

if __name__ == '__main__':
    print(f"🚀 Sol Pro AI Bridge iniciado en http://localhost:5005")
    app.run(port=5005, debug=os.environ.get("FLASK_DEBUG", "false").lower() == "true")
