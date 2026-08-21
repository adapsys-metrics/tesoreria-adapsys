# Tesorería Adapsys

Ver [CLAUDE.md](./CLAUDE.md) para el contexto completo del negocio y las reglas del
dominio. Este README es solo la puesta en marcha técnica.

## Stack

Next.js (App Router) + Supabase (Postgres, Auth, RLS), desplegado en Vercel.

## Requisitos

- Node.js 22+ (lo exige `@supabase/supabase-js`; en Vercel: Project Settings →
  General → Node.js Version → 22.x)
- Una cuenta de Supabase (proyecto gratuito alcanza para el volumen actual)
- Acceso a Google Cloud Console para el OAuth client (login corporativo)

## 1. Instalar dependencias

```bash
npm install
```

## 2. Crear el proyecto Supabase

### Opción A — por el dashboard (no requiere instalar nada)

Es la vía recomendada si no tienes Node ni Homebrew en la máquina.

1. Crear un proyecto nuevo en [supabase.com](https://supabase.com) → **New project**.
   - **Name**: `tesoreria-adapsys`
   - **Database password**: genera una y guárdala en el gestor de contraseñas; se usa
     solo para conectarse por SQL directo, no para la app.
   - **Region**: `South America (São Paulo)` es la más cercana a Chile.
2. Esperar a que termine de aprovisionar (un par de minutos).
3. Ir a **SQL Editor → New query** y correr, **en este orden**, pegando el contenido
   completo de cada archivo y apretando *Run*:

   | # | Archivo | Qué hace |
   |---|---|---|
   | 1 | `supabase/migrations/0001_esquema.sql` | Tablas, vistas, triggers y constraints |
   | 2 | `supabase/migrations/0002_rls.sql` | Row Level Security por dominio corporativo |
   | 3 | `supabase/seed.sql` | Empresas, cuentas, 284 subcategorías y parámetros |

   Cada uno debe decir *Success. No rows returned*. Si alguno falla, **detenerse ahí**:
   los siguientes dependen del anterior.

4. Verificar en **Table Editor** que `subcategorias` tenga 284 filas y `cuentas` 11.

### Opción B — por la CLI (requiere Node o Homebrew)

```bash
supabase login
supabase link --project-ref <tu-project-ref>
supabase db push                                   # aplica migrations/*.sql
psql "$(supabase db url)" -f supabase/seed.sql     # carga el catálogo
```

### Después, en cualquiera de las dos

En **Project Settings → API**, copiar `Project URL` y `anon public key`. Van a
`.env.local` para desarrollo (copiar `.env.example` como base) y a las variables de
entorno de Vercel para producción.

> El catálogo de `supabase/seed.sql` se genera desde `lib/catalogo.ts` con
> `python3 scripts/gen_seed.py`. Si el catálogo cambia se edita el TS y se re-genera;
> nunca al revés.

### Sobre el esquema

`supabase/esquema.test.ts` corre las tres migraciones contra un Postgres real
(pglite) y verifica que las reglas del modelo se cumplan en la base: que la moneda
de un movimiento sea la de su cuenta, que las líneas de un split cuadren, que los
dominios cerrados rechacen valores inventados. Se ejecuta con `npm test` junto al
resto, así que un error de SQL se detecta antes de aplicarlo en Supabase.

## 3. Configurar login con Google

El login usa Supabase Auth con el proveedor Google, restringido al dominio
`adapsysgroup.com` (dos capas: `hd` param en la request de OAuth + chequeo de
dominio en `lib/supabase/middleware.ts` y en la política RLS `fn_es_usuario_autorizado`).

1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   crear un **OAuth 2.0 Client ID** de tipo "Web application".
2. Authorized redirect URI: `https://<tu-project-ref>.supabase.co/auth/v1/callback`.
3. En Supabase Dashboard → **Authentication → Providers → Google**, pegar el
   Client ID y Client Secret.
4. En **Authentication → URL Configuration**, agregar como Redirect URL:
   - `http://localhost:3000/auth/callback` (desarrollo)
   - `https://<tu-dominio-en-vercel>/auth/callback` (producción)

Si el dominio corporativo cambiara, hay que actualizarlo en tres lugares:
`.env.local` (`NEXT_PUBLIC_DOMINIO_CORPORATIVO`), `lib/supabase/middleware.ts`,
y la función `fn_es_usuario_autorizado` (migración nueva, no editar la 0002).

## 4. Correr en local

```bash
npm run dev
```

## 5. Desplegar en Vercel

```bash
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add NEXT_PUBLIC_DOMINIO_CORPORATIVO
vercel deploy --prod
```

O conectar el repo directamente desde el dashboard de Vercel y cargar las mismas
variables de entorno ahí (Project Settings → Environment Variables).

### Preview sin proyecto Supabase todavía

La app no explota si `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
no están cargadas — el middleware deja pasar sin exigir login, la home muestra
un aviso en vez de consultar la base, y el botón de login queda deshabilitado.
Sirve para desplegar temprano y revisar visualización/usabilidad del shell
antes de tener el backend armado (ver `lib/supabase/estado.ts`). Apenas se
carguen esas dos variables, el flujo real de login + datos se activa solo.

## Estructura

```
app/                    Rutas (App Router)
  login/                Pantalla de login
  auth/callback/        Canje de código OAuth por sesión
  auth/signout/         Cierre de sesión
lib/supabase/           Clientes de Supabase (browser, server, middleware)
supabase/migrations/    Esquema — ver CLAUDE.md §3
supabase/seed.sql       Catálogo real (generado, no editar a mano)
scripts/gen_seed.py     Generador del seed a partir de tesoreria.jsx
types/database.types.ts Tipos de las tablas (a reemplazar por `npm run db:types`)
```

## Estado

Este commit es el scaffold: esquema, RLS y auth funcionando de punta a punta
(login → sesión → lectura de `empresas` con las políticas RLS aplicadas). Las
vistas de negocio (flujo de caja, movimientos, conciliación, presupuesto,
reportes, categorías — ver CLAUDE.md §6) todavía no están construidas.
