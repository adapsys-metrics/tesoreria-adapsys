#!/usr/bin/env python3
"""
Genera supabase/seed.sql a partir de lib/catalogo.ts, que es la fuente de verdad del
catálogo (ver CLAUDE.md §5 y §11). Si el catálogo cambia, se edita el TS y se corre
este script; nunca al revés.

Uso: python3 scripts/gen_seed.py
"""
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FUENTE = RAIZ / "lib" / "catalogo.ts"
SALIDA = RAIZ / "supabase" / "seed.sql"


def extraer_bloque(texto, declaracion):
    m = re.search(rf"export const {declaracion} = \[(.*?)\n\];", texto, re.S)
    if not m:
        raise SystemExit(f"No encontré '{declaracion}' en {FUENTE}")
    return m.group(1)


def extraer_objetos(bloque):
    """Cada línea del array es un objeto plano { clave: valor, ... }."""
    objetos = []
    for linea in bloque.splitlines():
        linea = linea.strip().rstrip(",")
        if not linea.startswith("{"):
            continue
        campos = {}
        for clave, valor in re.findall(
            r'(\w+):\s*("(?:[^"\\]|\\.)*"|true|false|-?\d+)', linea.strip("{} ")
        ):
            if valor.startswith('"'):
                campos[clave] = valor[1:-1].replace('\\"', '"')
            elif valor in ("true", "false"):
                campos[clave] = valor == "true"
            else:
                campos[clave] = int(valor)
        objetos.append(campos)
    return objetos


def sql(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def main():
    texto = FUENTE.read_text(encoding="utf-8")
    empresas = extraer_objetos(extraer_bloque(texto, r"EMPRESAS: Empresa\[\]"))
    cuentas = extraer_objetos(extraer_bloque(texto, r"CUENTAS: Cuenta\[\]"))
    categorias = extraer_objetos(extraer_bloque(texto, r"CATEGORIAS: Categoria\[\]"))
    subcategorias = extraer_objetos(extraer_bloque(texto, r"SUBCATEGORIAS: Subcategoria\[\]"))

    out = [
        "-- Generado por scripts/gen_seed.py desde lib/catalogo.ts — no editar a mano.",
        "-- Re-generar con: python3 scripts/gen_seed.py",
        "",
    ]

    def tabla(nombre, columnas, filas, clave_por_columna):
        out.append(f"insert into {nombre} ({', '.join(columnas)}) values")
        cuerpo = []
        for f in filas:
            valores = ", ".join(sql(clave_por_columna(f, c)) for c in columnas)
            cuerpo.append(f"  ({valores})")
        out.append(",\n".join(cuerpo) + ";\n")

    tabla(
        "empresas",
        ["id", "nombre", "corto", "grupo"],
        empresas,
        lambda f, c: f[c],
    )
    tabla(
        "cuentas",
        ["id", "empresa_id", "nombre", "moneda", "tipo", "saldo_inicial", "principal"],
        cuentas,
        lambda f, c: f.get(c, False if c == "principal" else f.get(c)),
    )
    tabla(
        "categorias",
        ["id", "nombre", "orden", "controlado"],
        categorias,
        lambda f, c: f.get(c, True if c == "controlado" else f.get(c)),
    )
    tabla(
        "subcategorias",
        ["id", "categoria_id", "nombre", "naturaleza", "activa"],
        subcategorias,
        lambda f, c: f.get(c, True if c == "activa" else f.get(c)),
    )

    out.append(
        "-- Parámetros con vigencia por año (§9) — verificar la tasa BHE vigente con el SII\n"
        "-- antes de dar por buena la de 2026 (Ley 21.133, escala hasta 2028).\n"
        "insert into parametros (clave, valor, vigencia_desde) values\n"
        "  ('tasa_iva', 0.19, '2000-01-01'),\n"
        "  ('tasa_bhe', 0.1525, '2026-01-01'),\n"
        "  ('tc_presupuesto', 970, '2026-01-01');\n"
    )

    SALIDA.write_text("\n".join(out), encoding="utf-8")
    print(
        f"Escribí {SALIDA} — {len(empresas)} empresas, {len(cuentas)} cuentas, "
        f"{len(categorias)} categorías, {len(subcategorias)} subcategorías."
    )


if __name__ == "__main__":
    main()
