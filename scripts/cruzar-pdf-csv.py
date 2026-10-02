# Cruza el PDF de un reporte de Quicken con su CSV. Cada uno trae bien una mitad:
# el PDF los montos con decimales y las glosas recortadas, el CSV las glosas enteras
# y los montos redondeados.
#
#   python3 scripts/leer-pdf-quicken.py "datos-quicken/X.pdf" > /tmp/x.txt
#   python3 scripts/cruzar-pdf-csv.py /tmp/x.txt "datos-quicken/X.csv" /tmp/x.json
#
# Calza fila a fila por fecha, contraparte y monto redondeado, y no escribe nada si
# alguna queda sin par: un calce parcial es peor que ninguno, porque el total cuadra
# igual y nadie lo mira dos veces.
import csv, re, sys
from decimal import Decimal

def plata(s):
    # El PDF escribe los negativos como "$-459,00-US": el signo aparece dos veces,
    # una pegada al número y otra a la moneda.
    s = s.replace('$', '').replace('US', '').strip()
    negativo = s.startswith('-') or s.endswith('-')
    s = s.strip('-').replace('.', '').replace(',', '.').strip()
    return Decimal('-' + s) if negativo else Decimal(s)

# ── PDF ───────────────────────────────────────────────────────────────────────
pdf = []
total_pdf = None
for linea in open(sys.argv[1], encoding='utf-8'):
    campos = linea.rstrip('\n').split('\t')
    if campos[0].startswith('Total') and len(campos) > 1:
        total_pdf = plata(campos[1]); continue
    if not re.fullmatch(r'\d{2}-\d{2}-\d{2}', campos[0]): continue
    monto = plata(campos[-1])
    pagador = campos[1] if len(campos) > 2 else ''
    nota = campos[2] if len(campos) > 3 else ''
    pdf.append({'fecha': campos[0], 'payee': pagador, 'nota': nota, 'monto': monto})

# ── CSV ───────────────────────────────────────────────────────────────────────
filas = list(csv.reader(open(sys.argv[2], encoding='utf-8-sig')))
cab = next(i for i, f in enumerate(filas) if 'Date' in f)
col = {n: i for i, n in enumerate(filas[cab])}
csvm = []
for f in filas[cab+1:]:
    if len(f) < 7 or not re.fullmatch(r'\d{2}-\d{2}-\d{2}', f[col['Date']].strip()):
        continue
    csvm.append({
        'fecha': f[col['Date']].strip(),
        'payee': f[col['Payee']].strip(),
        'categoria': f[col['Category']].strip(),
        'memo': f[col['Memo/Notes']].strip(),
        'monto': plata(f[col['Amount']]),
    })

print(f"PDF: {len(pdf)} filas, suma {sum(p['monto'] for p in pdf)}, total impreso {total_pdf}")
print(f"CSV: {len(csvm)} filas, suma {sum(c['monto'] for c in csvm)}")

# ── Calce ─────────────────────────────────────────────────────────────────────
# Por fecha + payee + monto redondeado. El PDF viene al revés (más nuevo primero).
libres = list(range(len(pdf)))
calce, huerfanos = [], []
for c in csvm:
    cand = [i for i in libres
            if pdf[i]['fecha'] == c['fecha']
            # Por prefijo: cuando el nombre es largo la celda queda pegada a la
            # columna siguiente y el payee arrastra la categoría detrás.
            and pdf[i]['payee'].startswith(c['payee'])
            and round(pdf[i]['monto']) == round(c['monto'])]
    if cand:
        i = cand[0]; libres.remove(i)
        calce.append({**c, 'exacto': pdf[i]['monto']})
    else:
        huerfanos.append(c)

print(f"calzaron {len(calce)}, sin calce {len(huerfanos)}, sobran del PDF {len(libres)}")
for h in huerfanos[:10]:
    print('  CSV sin par:', h['fecha'], h['payee'], h['monto'], h['memo'][:40])
for i in libres[:10]:
    print('  PDF sin par:', pdf[i]['fecha'], pdf[i]['payee'], pdf[i]['monto'])

if not huerfanos and not libres:
    s = sum(c['exacto'] for c in calce)
    print(f"suma con decimales: {s}  (total impreso {total_pdf}, difiere {s - total_pdf})")
    import json
    json.dump([{**c, 'monto': str(c['monto']), 'exacto': str(c['exacto'])} for c in calce],
              open(sys.argv[3], 'w'), ensure_ascii=False, indent=1)
    print('escrito', sys.argv[3])
