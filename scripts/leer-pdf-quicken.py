# Lee un reporte "Transactions by Account" de Quicken exportado a PDF.
#
#   python3 scripts/leer-pdf-quicken.py "datos-quicken/Cta cte Perú.pdf"
#
# Sale una fila por línea, con las celdas separadas por tabulador. Sirve cuando el
# CSV salió con los decimales ocultos: el PDF sí los trae. A cambio recorta las
# columnas largas con "…", así que las glosas hay que sacarlas del CSV
# (scripts/cruzar-pdf-csv.py).
#
# Tres cosas que hay que respetar o los datos salen mal:
#   - La posición de cada celda es CTM × Tm compuestas. Quicken usa las dos: unas
#     celdas llevan la coordenada en el `cm` y el `Tm` en cero, y otras al revés.
#     Mirando solo el Tm, media tabla aterriza en el origen y sale un amasijo.
#   - Las fuentes van en MacRomanEncoding. Leerlo como latin-1 se come las tildes
#     y "Echeverría" queda "Echeverra".
#   - El "$" viene en una fuente aparte de un solo glifo, donde el byte 0x21 ("!")
#     mapea a U+0024. Sin eso cada monto arranca con un "!".
import re, sys, zlib

datos = open(sys.argv[1], 'rb').read()

# Las fuentes de un solo glifo son el "$".
objetos_dolar = {
    m.group(1).decode()
    for m in re.finditer(rb'(\d+) 0 obj\s*<< /Type /Font.*?>>', datos, re.S)
    if b'/FirstChar 33 /LastChar 33' in m.group(0)
}
FUENTES_DOLAR = {
    m.group(1).decode()
    for m in re.finditer(rb'/(TT\d+) (\d+) 0 R', datos)
    if m.group(2).decode() in objetos_dolar
}

def por(m1, m2):
    """Composición de dos matrices afines [a b c d e f]."""
    a1, b1, c1, d1, e1, f1 = m1
    a2, b2, c2, d2, e2, f2 = m2
    return (a1*a2 + b1*c2, a1*b2 + b1*d2,
            c1*a2 + d1*c2, c1*b2 + d1*d2,
            e1*a2 + f1*c2 + e2, e1*b2 + f1*d2 + f2)

UNO = (1.0, 0, 0, 1.0, 0, 0)

def literal(cuerpo):
    salida, i = [], 0
    while i < len(cuerpo):
        c = cuerpo[i]
        if c == 0x5c:
            i += 1
            if i >= len(cuerpo): break
            s = cuerpo[i]
            mapa = {0x6e: 10, 0x72: 13, 0x74: 9, 0x62: 8, 0x66: 12}
            if s in mapa:
                salida.append(mapa[s]); i += 1
            elif 0x30 <= s <= 0x37:
                j = 0
                while j < 3 and i + j < len(cuerpo) and 0x30 <= cuerpo[i+j] <= 0x37:
                    j += 1
                salida.append(int(cuerpo[i:i+j].decode('latin-1'), 8)); i += j
            else:
                salida.append(s); i += 1
        else:
            salida.append(c); i += 1
    return bytes(salida)

NUM = r'-?[\d.]+'
PATRON = re.compile((
    r'\((?:[^()\\]|\\.)*\)|'
    r'\[(?:[^\[\]\\]|\\.)*\]|'
    r'/(TT\d+)\s+[\d.]+\s+Tf|'
    rf'({NUM})\s+({NUM})\s+({NUM})\s+({NUM})\s+({NUM})\s+({NUM})\s+(cm|Tm)|'
    rf'({NUM})\s+({NUM})\s+(?:Td|TD)|'
    r'\bq\b|\bQ\b|\bBT\b|T\*'
).encode('latin-1'))

paginas = []
for m in re.finditer(rb'stream\r?\n', datos):
    ini = m.end()
    fin = datos.find(b'endstream', ini)
    if fin < 0: continue
    try:
        t = zlib.decompress(datos[ini:fin])
    except zlib.error:
        continue
    if b'TJ' not in t and b'Tj' not in t:
        continue

    ctm, pila, tm, fuente = UNO, [], UNO, ''
    filas = {}
    for g in PATRON.finditer(t):
        bruto = g.group(0)
        if g.group(1):
            fuente = g.group(1).decode()
        elif g.group(8):                      # cm o Tm
            vals = tuple(float(g.group(i)) for i in range(2, 8))
            if g.group(8) == b'cm':
                ctm = por(vals, ctm)
            else:
                tm = vals
        elif g.group(9) is not None:          # Td / TD
            tm = por((1, 0, 0, 1, float(g.group(9)), float(g.group(10))), tm)
        elif bruto == b'q':
            pila.append(ctm)
        elif bruto == b'Q':
            if pila: ctm = pila.pop()
        elif bruto == b'BT':
            tm = UNO
        elif bruto == b'T*':
            tm = por((1, 0, 0, 1, 0, -12), tm)
        else:
            if bruto.startswith(b'['):
                crudo = b''.join(literal(p[1:-1])
                                 for p in re.findall(rb'\((?:[^()\\]|\\.)*\)', bruto))
            else:
                crudo = literal(bruto[1:-1])
            txt = '$' if fuente in FUENTES_DOLAR else crudo.decode('mac_roman')
            if txt.strip():
                _, _, _, _, x, y = por(tm, ctm)
                filas.setdefault(round(y, 0), []).append((x, txt))

    todo = ' '.join(c[1] for ys in filas.values() for c in ys)
    orden = re.search(r'Page (\d+) of', todo)
    paginas.append((int(orden.group(1)) if orden else 99, filas))

for _, filas in sorted(paginas):
    for y in sorted(filas, reverse=True):
        celdas = sorted(filas[y])
        # Trozos casi pegados son una misma celda: Quicken parte "Cuenta corriente
        # Perú-…" en varios strings, y el "…" del recorte viene aparte.
        linea, ultimo = [], None
        for cx, txt in celdas:
            if ultimo is not None and cx - ultimo < 12:
                linea[-1] += txt
            else:
                linea.append(txt)
            ultimo = cx + len(txt) * 5.2
        print('\t'.join(linea))
