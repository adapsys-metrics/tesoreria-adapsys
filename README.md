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
   | 3 | `supabase/seed.sql` | Empresas, cuentas, 290 categorías y parámetros. Se carga **antes** de `0003`, que inserta catálogo y necesita que exista; en ese punto de la cadena las tablas todavía se llaman `categorias` (los grupos) y `subcategorias` (las categorías) — el renombre a tres niveles llega en `0012` y arrastra las filas. |

   Cada uno debe decir *Success. No rows returned*. Si alguno falla, **detenerse ahí**:
   los siguientes dependen del anterior.

4. Verificar en **Table Editor** que, con todas las migraciones aplicadas, `grupos` tenga 16 filas, `categorias` 290, `subcategorias` 3 y `cuentas` 13.

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
   - `https://tesoreria.adapsysgroup.com/auth/callback` (producción, ver "Dominio propio")

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

### Revisar los despliegues

La pestaña **Deployments** del repo en GitHub es el lugar para eso. Tiene una barra de
entornos a la izquierda, y ahí está la trampa: **puede haber entornos huérfanos**. Si
el proyecto de Vercel se recreó o cambió de nombre, Vercel empieza a publicar en uno
nuevo llamado `Production – <proyecto>` y el viejo, llamado `Production` a secas, se
queda con su último despliegue y no recibe nunca más. Abrirlo hace parecer que no se
despliega hace semanas.

El entorno bueno es el que tiene despliegues recientes. Los huérfanos se borran desde
*Manage environments*.

### Dominio propio

Es lo que conviene tener: una dirección fija, dictable por teléfono, que no cambia con
cada push. Y resuelve un problema concreto de **Deployment Protection**.

**El problema.** Con Deployment Protection activo, las URLs `*.vercel.app` del proyecto
—tanto las de cada despliegue como la estable— quedan detrás del SSO de Vercel: para
abrirlas hay que ser miembro del equipo. Eso es más restrictivo de lo que se busca, y
por el lado equivocado: obliga a dar cuenta de Vercel a quien solo tiene que usar la
app, y con ella acceso a los demás proyectos del equipo.

La app **ya tiene su propio control de acceso**, y es más fino: hay que estar en
`usuarios_autorizados` **y** tener correo corporativo (§1). El SSO de Vercel no agrega
seguridad sobre eso, agrega una llave distinta para gente distinta.

**Los pasos.** El orden importa: si se cambia el dominio antes de registrar la URL de
callback, el login queda roto en el intermedio.

1. **Vercel** → *Projects* → **el proyecto** → *Settings → Domains* → *Add Domain*:
   `tesoreria.adapsysgroup.com`.

   Ojo: hay **dos** menús llamados Domains. El de la barra lateral del equipo
   administra los dominios de la cuenta; el que sirve acá es el de **adentro del
   proyecto**, que es el que decide a qué despliegue apunta. Con dos proyectos
   conectados al mismo repo, entrar por el del equipo es como se termina apuntando al
   proyecto equivocado.
2. **DNS de `adapsysgroup.com`** → el registro `CNAME` que indique Vercel.

   El DNS está en **Cloudflare** (`ivy.ns` / `owen.ns.cloudflare.com`), no en Vercel:
   lo carga quien administre esa cuenta. Y el apex y `www` resuelven a IPs de
   Cloudflare, así que el sitio corporativo se sirve por ahí con algún origen detrás.

   **Ojo con "Reclamar la propiedad del dominio".** `adapsysgroup.com` ya está tomado
   por otra cuenta de Vercel, así que al agregar el subdominio Vercel pide un TXT en
   `_vercel.adapsysgroup.com` y ofrece "Verificar y reclamar". El TXT en sí es
   inofensivo —es un registro nuevo—, pero el botón habla de *transferencia de
   propiedad*: si el sitio corporativo se sirve desde esa otra cuenta, reclamar el
   dominio puede dejarlo respondiendo 404. Antes de apretarlo hay que averiguar quién
   tiene el dominio en Vercel y qué proyecto sirve el sitio.
3. **Google Cloud Console** → el OAuth Client → *Authorized redirect URIs*. Ahí va la
   de Supabase (`https://<project-ref>.supabase.co/auth/v1/callback`), que no cambia:
   Google le responde a Supabase, no a la app.
4. **Supabase** → *Authentication → URL Configuration*:
   - *Site URL*: `https://tesoreria.adapsysgroup.com`
   - *Redirect URLs*: agregar `https://tesoreria.adapsysgroup.com/auth/callback` y
     dejar `http://localhost:3000/auth/callback` para desarrollo.
5. **Comprobar en una ventana privada.** Tiene que pedir el login de la app —el botón
   de Google— y **no** el SSO de Vercel. Si aparece el de Vercel, en *Settings →
   Deployment Protection* hay que dejar de proteger producción; la protección sigue
   teniendo sentido para los despliegues de preview.

Recién cuando el paso 5 pase, avisarles a las otras dos personas: hasta entonces les va
a pedir una cuenta de Vercel que no tienen.

**El dominio no es el camino corto.** Si lo que urge es que las otras dos personas
puedan entrar, alcanza con apagar la protección de producción (paso 5) — eso no depende
de nadie más. El control de acceso queda donde siempre estuvo: la lista de autorizados
más el dominio corporativo. El dominio propio es comodidad, y puede resolverse después
sin bloquear a nadie.

### Cuál es el link de la app

**El link que aparece en cada despliegue no es el que hay que guardar.** Es la URL de
*ese despliegue puntual*, lleva un hash (`tesoreria-adapsys-83xrvco6u-...`) y **Vercel
la borra al cabo de un tiempo** por su política de retención: queda devolviendo
`410 GONE` aunque la app esté perfectamente viva.

El link que hay que usar es el **dominio estable del proyecto** —el que no lleva hash—,
que Vercel apunta siempre al último despliegue de producción. Está en el dashboard de
Vercel, en el proyecto, arriba: *Domains*. Ese es el que se guarda en favoritos y el
que se comparte.

Además es el único que sirve para el login: la URL de callback de Google
(`https://<dominio>/auth/callback`) se registra una vez, y una URL con hash cambia en
cada despliegue.

**Un repo, un proyecto de Vercel.** Si el mismo repositorio quedó conectado a dos
proyectos, cada push despliega dos veces y hay dos apps contra la misma base. No es
solo ruido: las variables de entorno y la URL de callback se configuran por proyecto,
así que uno de los dos puede quedar apuntando a otra parte o sin poder iniciar sesión.
Conviene dejar uno solo y borrar el resto.

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
