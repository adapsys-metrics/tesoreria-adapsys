#!/usr/bin/env python3
"""
Migración de una sola vez: extrae el catálogo real (empresas, cuentas, grupos y
las 284 categorías) del prototipo tesoreria.jsx y lo escribe como
lib/catalogo.ts, que a partir de ahí es la ÚNICA fuente de verdad.

scripts/gen_seed.py lee lib/catalogo.ts (no este prototipo) para generar el SQL.
Se conserva este script solo para documentar de dónde salieron los datos.

Uso: python3 scripts/gen_catalogo.py
"""
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FUENTE = RAIZ / "tesoreria.jsx"
SALIDA = RAIZ / "lib" / "catalogo.ts"

# El prototipo usa "Empresas relacionadas" como grupo, pero el esquema restringe
# grupo a 'Adapsys' | 'Relacionadas'. Se normaliza acá; la etiqueta larga vive en
# GRUPOS, para la UI.
GRUPOS = {"Adapsys": "Adapsys", "Empresas relacionadas": "Relacionadas"}


def extraer_bloque(texto, nombre_const):
    m = re.search(rf"const {nombre_const} = \[(.*?)\n\];", texto, re.S)
    if not m:
        raise SystemExit(f"No encontré {nombre_const} en {FUENTE}")
    return m.group(1)


def extraer_objetos(bloque):
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


def ts(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return str(v)
    return '"' + str(v).replace("\\", "\\\\").replace('"', '\\"') + '"'


def main():
    texto = FUENTE.read_text(encoding="utf-8")
    empresas = extraer_objetos(extraer_bloque(texto, "EMPRESAS"))
    cuentas = extraer_objetos(extraer_bloque(texto, "CUENTAS"))
    grupos = extraer_objetos(extraer_bloque(texto, "CATS_INI"))
    categorias = extraer_objetos(extraer_bloque(texto, "SUBS_INI"))

    o = []
    o.append("// Catálogo real de Adapsys — 16 grupos, 284 categorías (CLAUDE.md §5).")
    o.append("// Generado una vez desde tesoreria.jsx con scripts/gen_catalogo.py.")
    o.append("// ESTA es la fuente de verdad: scripts/gen_seed.py lee este archivo para")
    o.append("// producir supabase/seed.sql. Editar acá, nunca el SQL.")
    o.append("")
    o.append('import type { Grupo, Cuenta, Empresa, Naturaleza, Categoria } from "@/lib/tipos";')
    o.append("")
    o.append("/** Etiqueta larga de cada grupo, para la UI. */")
    o.append("export const GRUPOS = [")
    o.append('  { id: "Adapsys" as const, nombre: "Adapsys" },')
    o.append('  { id: "Relacionadas" as const, nombre: "Empresas relacionadas" },')
    o.append("];")
    o.append("")
    o.append("export const EMPRESAS: Empresa[] = [")
    for e in empresas:
        grupo = GRUPOS[e["grupo"]]
        o.append(
            f'  {{ id: {ts(e["id"])}, nombre: {ts(e["nombre"])}, '
            f'corto: {ts(e["corto"])}, grupo: {ts(grupo)} }},'
        )
    o.append("];")
    o.append("")
    o.append("export const IDS_ADAPSYS = EMPRESAS.filter((e) => e.grupo === \"Adapsys\").map((e) => e.id);")
    o.append("")
    o.append("/** Presets del filtro global de empresas. */")
    o.append("export const PRESETS_EMPRESA = [")
    o.append('  { id: "ads", nombre: "Adapsys", ids: IDS_ADAPSYS },')
    o.append('  { id: "todas", nombre: "Todas", ids: EMPRESAS.map((e) => e.id) },')
    o.append('  { id: "rel", nombre: "Relacionadas", ids: ["sm"] },')
    o.append("];")
    o.append("")
    o.append("export const CUENTAS: Cuenta[] = [")
    for c in cuentas:
        o.append(
            f'  {{ id: {ts(c["id"])}, empresa_id: {ts(c["empresa"])}, nombre: {ts(c["nombre"])}, '
            f'moneda: {ts(c["moneda"])}, tipo: {ts(c["tipo"])}, '
            f'saldo_inicial: {ts(c["saldo"])}, principal: {ts(c.get("principal", False))} }},'
        )
    o.append("];")
    o.append("")
    o.append("export const NATURALEZAS: { id: Naturaleza; nombre: string }[] = [")
    o.append('  { id: "ingreso", nombre: "Ingresos" },')
    o.append('  { id: "inversion", nombre: "Gastos de Inversión" },')
    o.append('  { id: "operativo", nombre: "Gastos Operativos" },')
    o.append("];")
    o.append("")
    o.append("export const RESPONSABLES = [")
    o.append('  "", "I+D", "Analítica avanzada", "Finanzas", "Personas", "Comercial", "Gerencia",')
    o.append("];")
    o.append("")
    o.append("export const GRUPOS: Grupo[] = [")
    for i, c in enumerate(grupos):
        o.append(
            f'  {{ id: {ts(c["id"])}, nombre: {ts(c["nombre"])}, '
            f'orden: {i}, controlado: {ts(c.get("controlado", True))} }},'
        )
    o.append("];")
    o.append("")
    o.append("export const CATEGORIAS: Categoria[] = [")
    for s in categorias:
        o.append(
            f'  {{ id: {ts(s["id"])}, grupo_id: {ts(s["cat"])}, nombre: {ts(s["nombre"])}, '
            f'naturaleza: {ts(s["nat"])}, activa: true }},'
        )
    o.append("];")
    o.append("")

    SALIDA.write_text("\n".join(o), encoding="utf-8")
    print(
        f"Escribí {SALIDA} — {len(empresas)} empresas, {len(cuentas)} cuentas, "
        f"{len(grupos)} grupos, {len(categorias)} categorías."
    )


if __name__ == "__main__":
    main()
