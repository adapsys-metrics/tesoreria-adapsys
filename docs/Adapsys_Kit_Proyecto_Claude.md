# Adapsys — Kit de Proyecto Claude
> Sube este archivo a las **instrucciones de tu proyecto** en Claude.ai. Una vez subido, Claude generará presentaciones siguiendo automáticamente la identidad de marca de Adapsys.

---

## CÓMO CONFIGURAR TU PROYECTO (3 pasos)

1. Crea un nuevo proyecto en Claude.ai
2. Ve a **Instrucciones del proyecto** y sube este archivo `.md`
3. Sube también los activos de marca: `image2.png` (logo blanco) y las fotos de contexto

**Listo.** Desde ahí, usa el prompt de la Sección 3 para generar cualquier presentación.

---

## 1. IDENTIDAD DE MARCA

### Quiénes somos
Adapsys es una consultora latinoamericana de transformación organizacional y desarrollo de liderazgo. El tono visual es **profesional, cálido y latinoamericano** — nunca frío ni corporativo genérico.

### Formato técnico
- **Proporción**: 16:10 (1920 × 1200 px)
- **Stack**: HTML + `deck_stage.js` (web component que maneja escalado, navegación con teclado y print-to-PDF)
- Cada slide es un `<section>` directo dentro de `<deck-stage>`
- Texto mínimo en slides: 24 px — títulos principales: 48–80 px

### Tipografía

```html
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&family=Roboto+Slab:wght@400;700&display=swap" rel="stylesheet">
```

| Peso | Uso |
|------|-----|
| Poppins Light 300 | Texto secundario |
| Poppins Regular 400 | Cuerpo de texto |
| Poppins Medium 500 | Títulos de slide, subtítulos |
| Poppins SemiBold 600 | Títulos de portada, énfasis, datos destacados |

**Prohibido**: Arial, Helvetica, Inter, Roboto sans, fuentes del sistema.  
**Énfasis de datos y cifras**: Poppins SemiBold (NUNCA Roboto Slab).

### Paleta de colores

> ⚠️ No inventar colores fuera de esta lista.

#### Primarios — Teal
| Nombre | Hex | Uso |
|--------|-----|-----|
| Teal Oscuro | `#006379` | Fondo portada, headers, títulos en slides claros |
| Teal Medio | `#0097A7` | Gradientes, fondos de sección |
| Teal Claro | `#00B8B8` | Acentos, contornos de círculos decorativos |
| Teal Menta | `#0BCDCD` | Highlights, palabra "Juntos" en portada |
| Teal Pastel | `#B6E6E6` | Fondo de slides de agenda |

#### Acento — Magenta
| Nombre | Hex | Uso |
|--------|-----|-----|
| Magenta Fuerte | `#C20C5B` | Círculo decorativo portada, palabra "progreso", énfasis |
| Rosa Brillante | `#EF2B97` | Acentos secundarios |
| Magenta Oscuro | `#740839` | Énfasis profundo ocasional |

#### Neutros
| Nombre | Hex | Uso |
|--------|-----|-----|
| Gris oscuro | `#595959` | Texto cuerpo en slides interiores |
| Gris medio | `#9E9E9E` | Texto secundario |
| Fondo claro | `#F3F3F3` | Fondo de slides de contenido |
| Blanco | `#FFFFFF` | Texto sobre fondos teal |

#### Gradiente principal
```css
background: linear-gradient(135deg, #006379 0%, #0097A7 50%, #00B8B8 100%);
```

### Elementos decorativos

Aplican **solo en slides con fondo teal** (portadas y divisores de sección). Los slides claros NO los llevan.

| Elemento | Descripción |
|----------|-------------|
| Círculo relleno teal | Esquina superior derecha, parcialmente recortado. Color sólido `#00B8B8` |
| Círculo contorno teal | Superpuesto al anterior. `border: 8–12px solid #00B8B8`, sin relleno |
| Círculo contorno magenta | Esquina inferior izquierda, parcialmente recortado. `border: 8–12px solid #C20C5B` |
| Grid de puntos | Esquina superior izquierda. Puntos circulares en `#0097A7` con opacidad 0.5–0.7 |

---

## 2. CATÁLOGO DE TEMPLATES

### Template 1 — Portada Principal
**Cuándo usar**: primer slide de cualquier presentación corporativa sin cliente específico.

- Fondo: gradiente teal
- Logo Adapsys blanco centrado (~30% del ancho)
- Tagline centrado: "**Juntos**" en `#0BCDCD` / "transformamos los desafíos en" en blanco / "**progreso**" en `#C20C5B`
- Elementos decorativos completos

---

### Template 2 — Portada de Taller / Proyecto (con logo cliente)
**Cuándo usar**: portada cuando hay un cliente específico.

- **Mitad izquierda**: foto de contexto con overlay `rgba(0, 99, 121, 0.65)`
- **Mitad derecha**: fondo gradiente teal
  - Logo Adapsys blanco, esquina superior derecha
  - Subtítulo en mayúsculas (ej: "REUNIONES")
  - Título del taller en mayúsculas grande
  - Fecha formato `dd | mm | aa`, abajo izquierda del área derecha
- **Círculo blanco con logo cliente**: superpuesto en la frontera entre mitades, abajo izquierda (~16% del ancho)

Placeholders: `{FOTO_CONTEXTO}` · `{SUBTITULO}` · `{TITULO_PROYECTO}` · `{FECHA}` · `{LOGO_CLIENTE}`

---

### Template 3 — Agenda
**Cuándo usar**: enumerar secciones o bloques temáticos.

- Fondo: `#B6E6E6` (Teal Pastel)
- Etiqueta "AGENDA": Poppins SemiBold, mayúsculas, `#006379`, esquina superior izquierda
- Ítems numerados: número grande decorativo `#006379` opacidad 0.3 + título Poppins Medium `#006379`
- Bloques opcionales a la derecha: "Propósito" y "Dinámica"

Placeholders: `{ITEMS_AGENDA}` · `{PROPOSITO}` · `{DINAMICA}`

---

### Template 4 — Divisor de Sección
**Cuándo usar**: separar bloques temáticos.

- Fondo: gradiente teal
- Número de sección: 8em+, Poppins SemiBold, blanco opacidad 0.1 (decorativo)
- Título de sección: Poppins SemiBold, blanco, grande
- Elementos decorativos completos

Placeholders: `{NUMERO_SECCION}` · `{TITULO_SECCION}`

---

### Template 5 — Slide de Contenido Interior ⭐
**Cuándo usar**: cualquier slide con texto, listas, tablas o gráficos. Es el más usado.

- Fondo: `#F3F3F3`
- **Barra superior**: color `#006379`, altura ~8%. Nombre de presentación (blanco, izq.) + número de slide (blanco, der.)
- **Título**: color `#006379`, Poppins Medium **24pt**, posición `x: 1.3cm, y: 0.41cm`
- **Cuerpo**: color `#595959`, Poppins Regular/Light, posición `x: 1.72cm, y: 3.73cm`
- **Sin** elementos decorativos (sin círculos, sin grid)
- **Sin** barra de color decorativa bajo el título

Placeholders: `{NOMBRE_PRESENTACION}` · `{NUMERO_SLIDE}` · `{TITULO_SLIDE}` · `{CUERPO_SLIDE}`

---

### Template 6 — Cierre / Contacto
**Cuándo usar**: último slide.

- Fondo: gradiente teal
- Datos de contacto en blanco
- QR opcional
- Elementos decorativos completos

Placeholders: `{DATOS_CONTACTO}` · `{QR_OPCIONAL}`

---

## 3. PROMPT PARA GENERAR UNA PRESENTACIÓN

Copia este prompt, rellena los `{campos}` y pégalo en el chat.

```
Necesito una presentación de Adapsys para {CLIENTE_O_TEMA}.

Contexto:
- Tipo de evento: {Taller / Reunión / Programa / Pitch}
- Audiencia: {comité ejecutivo / mandos medios / equipo / etc.}
- Fecha: {dd/mm/aa}
- Duración estimada: {Nº} minutos

Estructura deseada:
1. Portada con logo cliente (Template 2): título "{TITULO}", subtítulo "{SUBTITULO}"
2. Agenda (Template 3) con los siguientes bloques:
   - {Bloque 1}
   - {Bloque 2}
3. Divisores de sección (Template 4) entre bloques
4. Slides de contenido (Template 5):
   - {Slide 1: título + bullets/párrafo}
   - {Slide 2: ...}
5. Cierre con contacto (Template 6)

Notas adicionales:
- {Cifras a destacar, citas, frases del cliente, etc.}
```

### Ejemplo aplicado

```
Necesito una presentación de Adapsys para Banco XYZ.

Contexto:
- Tipo de evento: Taller de alineamiento ejecutivo
- Audiencia: Comité ejecutivo (12 personas)
- Fecha: 15/06/26
- Duración estimada: 90 minutos

Estructura deseada:
1. Portada con logo cliente (Template 2): título "COMITÉ EJECUTIVO", subtítulo "REUNIÓN DE ALINEAMIENTO"
2. Agenda (Template 3):
   - Contexto y desafíos del año
   - Definiciones estratégicas
   - Roles y responsabilidades
   - Cierre y compromisos
3. Divisores de sección entre cada bloque
4. Slides de contenido:
   - "El contexto que nos toca" — 3 bullets sobre cambios de mercado
   - "Nuestro propósito" — párrafo + 1 cita destacada
   - "La coalición de cambio" — diagrama de roles
   - "Compromisos para los próximos 90 días" — tabla de 4 filas
5. Cierre con contacto

Notas: incluir el dato "84% de equipos reportan mayor claridad" en énfasis Poppins SemiBold magenta
```

---

## 4. REGLAS RÁPIDAS (para tener siempre presentes)

| ✅ Siempre | ❌ Nunca |
|-----------|---------|
| Poppins para todo el texto | Arial, Helvetica, Inter u otras fuentes del sistema |
| Solo colores de la paleta oficial | Inventar colores o gradientes nuevos |
| Elementos decorativos en slides teal | Elementos decorativos en slides claros |
| Barra superior `#006379` en slides interiores | Barra decorativa bajo el título en slides interiores |
| Logo Adapsys en blanco sobre fondos oscuros | Logo Adapsys en color sobre fondos teal |
| Overlay teal `rgba(0,99,121,0.65)` en fotos | Fotos sin overlay |
| Logo cliente en círculo blanco | Logo cliente en cuadrado o rectángulo |
| Énfasis numérico en Poppins SemiBold magenta | Énfasis numérico en Roboto Slab |
| Tono profesional cálido latinoamericano | Jerga corporativa fría o anglicismos innecesarios |
| Mínimo 24px en texto de slides | Texto pequeño o ilegible |

---

## 5. ACTIVOS NECESARIOS

Subir al proyecto junto con este archivo:

| Archivo | Descripción | Obligatorio |
|---------|-------------|-------------|
| `image2.png` | Logo Adapsys blanco sobre transparente | ✅ Sí |
| Logo Adapsys color | Para fondos claros | Opcional |
| Fotos de contexto | Personas, equipos, espacios de trabajo, alta resolución | Recomendado |
| Logos de clientes | Si trabajas habitualmente con los mismos clientes | Opcional |

> Si no tienes los activos al generar, Claude mostrará cajas grises etiquetadas como "Logo cliente" o "Foto contexto". Nunca intentará inventarlos.

---

## CHECKLIST ANTES DE ENTREGAR

- [ ] Formato 16:10 (1920×1200)
- [ ] Fuente Poppins cargada desde Google Fonts
- [ ] Solo colores de la paleta oficial
- [ ] Portadas y secciones tienen los 3 elementos decorativos
- [ ] Slides interiores tienen barra superior + título y cuerpo en posición correcta
- [ ] Slides interiores NO tienen barra decorativa bajo el título
- [ ] Slides interiores NO tienen círculos ni grids decorativos
- [ ] Logo Adapsys en blanco sobre fondos oscuros
- [ ] Fotografías con overlay teal cuando aplica
- [ ] Énfasis numérico en Poppins SemiBold magenta (no Roboto Slab)
- [ ] Sin emojis, sin íconos genéricos, sin gradientes inventados

---

*Kit generado desde el proyecto maestro de Adapsys — Claude Design.*  
*Para actualizaciones de marca, contactar al responsable del proyecto.*
