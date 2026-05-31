import hashlib, json
SYSTEM_PEPPER = "SOLPRO_ULTRA_SECRET_2026_#!"
nueva_pass = "Admin2026!"
hash_nuevo = hashlib.sha256((nueva_pass + SYSTEM_PEPPER).encode()).hexdigest()
print(f"Hash generado: {hash_nuevo}")
