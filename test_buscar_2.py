def buscar_cliente(query, clientes):
    q = query.upper().strip()
    if len(q) < 3:
        return list(clientes.values())
    matches = []
    seen = set()
    for key, c in clientes.items():
        score = 0
        if q == key:
            score = 100
        elif key.startswith(q):
            score = 80
        elif q in key:
            score = 60
        for alias in c.get('aliases', []):
            a = alias.upper()
            if q == a:
                score = max(score, 95)
            elif a.startswith(q):
                score = max(score, 75)
            elif q in a:
                score = max(score, 55)
        if score > 0 and key not in seen:
            matches.append((score, c))
            seen.add(key)
    matches.sort(key=lambda x: x[0], reverse=True)
    return [m[1] for m in matches]

clientes_mock = {
    'GRUPO VARGAS S.R.L': {
        'nombre': 'GRUPO VARGAS S.R.L',
        'aliases': ['JESSY LENS S.R.L', 'BRUPO VARGAS', 'JESSY LENS']
    },
    'JESSICA PORTILLO': {
        'nombre': 'JESSICA PORTILLO',
        'aliases': []
    }
}

print("Test 2 - Buscar 'JESSY':")
res1 = buscar_cliente('JESSY', clientes_mock)
for i, c in enumerate(res1):
    print(f" {i+1}. {c['nombre']}")

print("\nTest 3 - Buscar 'JESSICA':")
res2 = buscar_cliente('JESSICA', clientes_mock)
for i, c in enumerate(res2):
    print(f" {i+1}. {c['nombre']}")
