# NexusFac — Sistema de Facturación Electrónica para Perú

Plataforma web para emisión y gestión de comprobantes electrónicos (facturas y boletas) integrada con SUNAT a través de la API de Nubefact.

---

## Características

- **Emisión de comprobantes** — Facturas (Tipo 01) y Boletas de Venta (Tipo 03)
- **Integración SUNAT** — Envío automático vía Nubefact; recibe XML y CDR de respuesta
- **Consulta RUC/DNI** — Autocompletado de datos del cliente desde SUNAT (Decolecta)
- **Gestión de clientes** — Registro con búsqueda por documento o nombre
- **Catálogo de productos** — Administración de productos/servicios con precios y unidades de medida
- **Dashboard** — Métricas de ventas, gráfico semanal, comprobantes recientes
- **PDF descargable** — Generación de comprobantes en PDF con layout oficial
- **Borradores** — Guarda comprobantes incompletos y emítelos después
- **Multi-empresa** — Soporte para múltiples empresas por instancia

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS 4 |
| Lenguaje | TypeScript |
| Base de datos | Supabase (PostgreSQL) |
| Autenticación | Supabase Auth |
| PDF | @react-pdf/renderer |
| Facturación electrónica | Nubefact API |
| Consulta SUNAT | Decolecta API |

---

## Requisitos previos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com) (tier gratuito funciona)
- Cuenta en [Nubefact](https://nubefact.com) (modo demo disponible sin costo)
- Token de [Decolecta](https://decolecta.com) para consultas RUC/DNI *(opcional)*

---

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/nexusfac.git
cd nexusfac
npm install
```

### 2. Variables de entorno

Crea el archivo `.env.local` en la raíz del proyecto:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# Nubefact (demo — no envía a SUNAT real)
NUBEFACT_URL=https://demo.nubefact.com/api/v1/{tu-account-id}
NUBEFACT_TOKEN=tu_token_demo

# Nubefact (producción — descomenta cuando estés listo)
# NUBEFACT_URL=https://api.nubefact.com/api/v1/{tu-account-id}
# NUBEFACT_TOKEN=tu_token_produccion

# Consulta RUC/DNI (opcional)
DECOLECTA_TOKEN=sk_xxxxx.xxxxx

# Email con Resend (para botón "Enviar por email")
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=NexusFac <noreply@tudominio.com>
```

### 3. Configurar la base de datos

Ejecuta la migración en el **SQL Editor de Supabase**:

```
supabase/migrations/001_facturape_schema.sql
```

Esto crea todas las tablas, funciones y políticas RLS necesarias.

### 4. Crear empresa y usuario inicial

Desde el dashboard de Supabase:

1. **Authentication** → crear usuario con email y contraseña
2. Insertar registro en la tabla `empresas` con los datos de tu negocio y token de Nubefact
3. Insertar registro en `empresa_usuarios` vinculando el usuario a la empresa

### 5. Correr en desarrollo

```bash
npm run dev
# → http://localhost:3000
```

---

## Scripts

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción
npm start        # Servidor de producción
npm run lint     # Linter
```

---

## Estructura del proyecto

```
nexusfac/
├── app/
│   ├── (auth)/login/          # Página de inicio de sesión
│   ├── (dashboard)/
│   │   ├── dashboard/         # Panel principal con métricas
│   │   ├── emitir/            # Creación de comprobantes
│   │   ├── comprobantes/      # Historial y detalle de comprobantes
│   │   ├── clientes/          # Gestión de clientes
│   │   ├── productos/         # Catálogo de productos
│   │   └── configuracion/     # Datos de empresa y series
│   ├── actions/
│   │   └── emitir-comprobante.ts   # Server action: emisión y borradores
│   └── api/sunat/route.ts          # Proxy para consultas RUC/DNI
├── components/
│   ├── DashboardShell.tsx     # Layout principal (sidebar + nav móvil)
│   ├── Sidebar.tsx
│   ├── ComprobantePdf.tsx     # Plantilla PDF
│   └── PdfDownloadButton.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts          # Cliente Supabase (browser)
│   │   └── server.ts          # Cliente Supabase (servidor)
│   ├── nubefact.ts            # Integración con Nubefact
│   └── numero-a-letras.ts     # Conversión numérica para comprobantes
├── types/
│   └── database.ts            # Tipos TypeScript de la base de datos
└── supabase/
    └── migrations/
        └── 001_facturape_schema.sql
```

---

## Base de datos

| Tabla | Descripción |
|-------|-------------|
| `empresas` | Datos de la empresa, token Nubefact, series y correlativos |
| `empresa_usuarios` | Relación usuario-empresa con roles (admin/vendedor) |
| `clientes` | Directorio de clientes con RUC/DNI |
| `productos` | Catálogo de productos y servicios |
| `comprobantes` | Registros de facturas y boletas emitidas |
| `comprobante_items` | Líneas de detalle de cada comprobante |

**Estados:** `borrador` → `enviado` → `aceptado` / `rechazado` / `anulado`

---

## Flujo de emisión

```
Usuario crea comprobante
        ↓
Server Action valida datos
        ↓
Envío a Nubefact API
        ↓
Nubefact reenvía a SUNAT
        ↓
Respuesta: XML + CDR
        ↓
Estado guardado en Supabase
```

---

## Despliegue

La forma más sencilla es [Vercel](https://vercel.com):

1. Conecta el repositorio en Vercel
2. Agrega las variables de entorno en el panel de Vercel
3. Despliega — Vercel detecta Next.js automáticamente

---

## Licencia

MIT
