# -*- coding: utf-8 -*-
import os

def fix_mojibake_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    text = text.replace('\ufeff', '')
    
    replacements = {
        'Ã³': 'ó', 'Ã¡': 'á', 'Ã©': 'é', 'Ã­': 'í', 'Ãº': 'ú',
        'Ã“': 'Ó', 'Ã ': 'Á', 'Ã‰': 'É', 'Ã ': 'Í', 'Ãš': 'Ú',
        'Ã±': 'ñ', 'Ã‘': 'Ñ',
        'ðŸ›’': '🛒', 'ðŸš«': '🚫', 'ðŸ“¦': '📦', 'ðŸ“Š': '📊', 'ðŸ¤–': '🤖',
        'ðŸ‘¤': '👤', 'âš™ï¸': '⚙️', 'ðŸšª': '🚪', 'ðŸ’¾': '💾', 'âš¡': '⚡',
        'ðŸ“¥': '📥', 'ðŸ“„': '📄', 'ðŸ”„': '🔄', 'â›”': '⛔', 'ðŸ›ï¸': '🛢️',
        'ðŸ””': '🔔', 'âš ï¸': '⚠️', 'âœ…': '✅', 'ðŸ’¡': '💡'
    }
    
    for bad, good in replacements.items():
        text = text.replace(bad, good)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(text)
    print(f'Reparado: {filepath}')

fix_mojibake_file('main_portal.py')
fix_mojibake_file(os.path.join('Creador de Facturas', 'app.py'))
