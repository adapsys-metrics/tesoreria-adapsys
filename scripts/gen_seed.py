#!/usr/bin/env python3
"""
Genera supabase/seed.sql a partir del catálogo real embebido en tesoreria.jsx
(EMPRESAS, CUENTAS, CATS_INI, SUBS_INI). Ver CLAUDE.md §5 y §11 — el catálogo de
284 subcategorías es el que el equipo ya usa en Quicken; no se re-inventa.

Uso: python3 scripts/gen_seed.py
"""
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FUENTE = RAIZ / "tesoreria.jsx"
SALIDA = RAIZ / "supabase" / "seed.sql"


def extraer_bloque(texto, nombre_const):
    m = re.search(rf"const {nombre_const} = \[(.*?)\n\];", texto, re.S)
    if not m:
        raise SystemExit(f"No encontré {nombre_const} en {FUENTE}")
    return m.group(1)


def extraer_objetos(bloque):
    """Cada línea del array fuente es un objeto plano { clave: valor, ... }.
    No hay objetos anidados en estos catálogos, así que un regex por línea basta."""
    objetos = []
    for linea in bloque.splitlines():
        linea = linea.strip().rstrip(",")
        if not linea.startswith("{"):
            continue
        contenido = linea.strip("{} ")
        campos = {}
        for parte in re.findall(r'(\w+):\s*("(?:[^"\\]|\\.)*"|true|false|-?\d+)', contenido):
            clave, valor = parte
            if valor.startswith('"'):
                valor = valor[1:-1].replace('\\"', '"')
            elif valor in ("true", "false"):
                valor = valor == "true"
            else:
                valor = int(valor)
            campos[clave] = valor
        objetos.append(campos)
    return objetos


def sql_str(v):
    if v is None:
        return "null"
    return "'" + str(v).replace("'", "''") + "'"


def sql_bool(v):
    return "true" if v else "false"


def main():
    texto = FUENTE.read_text(encoding="utf-8")

    empresas = extraer_objetos(extraer_bloque(texto, "EMPRESAS"))
    cuentas = extraer_objetos(extraer_bloque(texto, "CUENTAS"))
    categorias = extraer_objetos(extraer_bloque(texto, "CATS_INI"))
    subcategorias = extraer_objetos(extraer_bloque(texto, "SUBS_INI"))

    out = []
    out.append("-- Generado por scripts/gen_seed.py a partir de tesoreria.jsx — no editar a mano.")
    out.append("-- Re-generar con: python3 scripts/gen_seed.py\n")

    out.append("insert into empresas (id, nombre, corto, grupo) values")
    out.append(
        ",\n".join(
            f"  ({sql_str(e['id'])}, {sql_str(e['nombre'])}, {sql_str(e['corto'])}, {sql_str(e['grupo'])})"
            for e in empresas
        )
        + ";\n"
    )

    out.append("insert into cuentas (id, empresa_id, nombre, moneda, tipo, saldo_inicial, principal) values")
    filas = []
    for c in cuentas:
        filas.append(
            f"  ({sql_str(c['id'])}, {sql_str(c['empresa'])}, {sql_str(c['nombre'])}, "
            f"{sql_str(c['moneda'])}, {sql_str(c['tipo'])}, {c['saldo']}, {sql_bool(c.get('principal', False))})"
        )
    out.append(",\n".join(filas) + ";\n")

    out.append("insert into categorias (id, nombre, orden, controlado) values")
    filas = []
    for i, cat in enumerate(categorias):
        filas.append(
            f"  ({sql_str(cat['id'])}, {sql_str(cat['nombre'])}, {i}, {sql_bool(cat.get('controlado', True))})"
        )
    out.append(",\n".join(filas) + ";\n")

    out.append("insert into subcategorias (id, categoria_id, nombre, naturaleza, activa) values")
    filas = []
    for s in subcategorias:
        filas.append(
            f"  ({sql_str(s['id'])}, {sql_str(s['cat'])}, {sql_str(s['nombre'])}, {sql_str(s['nat'])}, true)"
        )
    out.append(",\n".join(filas) + ";\n")

    out.append(
        "-- Parámetros con vigencia por año (§9) — verificar la tasa BHE vigente con el SII\n"
        "-- antes de dar por buena la de 2026 (Ley 21.133, escala hasta 2028).\n"
        "insert into parametros (clave, valor, vigencia_desde) values\n"
        "  ('tasa_iva', 0.19, '2000-01-01'),\n"
        "  ('tasa_bhe', 0.1525, '2026-01-01'),\n"
        "  ('tc_presupuesto', 970, '2026-01-01');\n"
    )

    SALIDA.write_text("\n".join(out), encoding="utf-8")
    print(f"Escribí {SALIDA} — {len(empresas)} empresas, {len(cuentas)} cuentas, "
          f"{len(categorias)} categorías, {len(subcategorias)} subcategorías.")


if __name__ == "__main__":
    main()
