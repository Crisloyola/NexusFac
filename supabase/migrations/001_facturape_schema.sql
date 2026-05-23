-- =============================================
-- FacturaPE - Schema completo con RLS
-- Ejecutar en Supabase Dashboard > SQL Editor
-- =============================================

-- Habilitar extensiones
create extension if not exists "uuid-ossp";

-- =============================================
-- TABLA: empresas
-- =============================================
create table public.empresas (
  id uuid primary key default uuid_generate_v4(),
  ruc text not null unique,
  razon_social text not null,
  nombre_comercial text,
  direccion text not null,
  ubigeo text,
  logo_url text,
  nubefact_token text,
  serie_factura text not null default 'F001',
  serie_boleta text not null default 'B001',
  correlativo_factura integer not null default 1,
  correlativo_boleta integer not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- TABLA: empresa_usuarios (multi-empresa)
-- =============================================
create table public.empresa_usuarios (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rol text not null check (rol in ('admin', 'vendedor')),
  created_at timestamptz default now(),
  unique(empresa_id, user_id)
);

-- =============================================
-- TABLA: clientes
-- =============================================
create table public.clientes (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  tipo_documento text not null check (tipo_documento in ('6', '1')) default '6',
  ruc_dni text not null,
  nombre text not null,
  direccion text,
  email text,
  telefono text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(empresa_id, ruc_dni)
);

-- =============================================
-- TABLA: productos
-- =============================================
create table public.productos (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  codigo text,
  nombre text not null,
  descripcion text,
  precio numeric(12,4) not null,
  unidad text not null default 'NIU',
  igv_incluido boolean not null default true,
  activo boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- TABLA: comprobantes
-- =============================================
create table public.comprobantes (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid references public.clientes(id),
  tipo text not null check (tipo in ('01', '03')),
  serie text not null,
  numero integer not null,
  fecha date not null default current_date,
  moneda text not null default 'PEN',
  tipo_operacion text not null default '0101',
  subtotal numeric(12,2) not null default 0,
  igv numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  estado text not null default 'borrador'
    check (estado in ('borrador', 'enviado', 'aceptado', 'rechazado', 'anulado')),
  xml_url text,
  cdr_url text,
  hash_cdr text,
  nubefact_response jsonb,
  observaciones text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(empresa_id, tipo, serie, numero)
);

-- =============================================
-- TABLA: comprobante_items
-- =============================================
create table public.comprobante_items (
  id uuid primary key default uuid_generate_v4(),
  comprobante_id uuid not null references public.comprobantes(id) on delete cascade,
  orden integer not null default 1,
  codigo text,
  descripcion text not null,
  unidad text not null default 'NIU',
  cantidad numeric(12,4) not null,
  precio_unitario numeric(12,4) not null,
  precio_con_igv numeric(12,4) not null,
  subtotal numeric(12,2) not null,
  igv numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  tipo_afectacion text not null default '10'
);

-- =============================================
-- FUNCIÓN: obtener empresa del usuario actual
-- =============================================
create or replace function public.get_user_empresa_id()
returns uuid
language sql
stable
security definer
as $$
  select empresa_id
  from public.empresa_usuarios
  where user_id = auth.uid()
  limit 1;
$$;

-- =============================================
-- FUNCIÓN: siguiente correlativo
-- =============================================
create or replace function public.get_next_correlativo(
  p_empresa_id uuid,
  p_tipo text
)
returns integer
language plpgsql
security definer
as $$
declare
  v_correlativo integer;
begin
  if p_tipo = '01' then
    update public.empresas
    set correlativo_factura = correlativo_factura + 1,
        updated_at = now()
    where id = p_empresa_id
    returning correlativo_factura - 1 into v_correlativo;
  else
    update public.empresas
    set correlativo_boleta = correlativo_boleta + 1,
        updated_at = now()
    where id = p_empresa_id
    returning correlativo_boleta - 1 into v_correlativo;
  end if;
  return v_correlativo;
end;
$$;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

alter table public.empresas enable row level security;
alter table public.empresa_usuarios enable row level security;
alter table public.clientes enable row level security;
alter table public.productos enable row level security;
alter table public.comprobantes enable row level security;
alter table public.comprobante_items enable row level security;

-- empresas: ver solo las propias
create policy "usuarios ven su empresa" on public.empresas
  for select using (
    id in (
      select empresa_id from public.empresa_usuarios where user_id = auth.uid()
    )
  );

create policy "admin actualiza empresa" on public.empresas
  for update using (
    id in (
      select empresa_id from public.empresa_usuarios
      where user_id = auth.uid() and rol = 'admin'
    )
  );

-- empresa_usuarios: solo propios
create policy "ver mis empresas" on public.empresa_usuarios
  for select using (user_id = auth.uid());

-- clientes: solo de la empresa del usuario
create policy "ver clientes empresa" on public.clientes
  for all using (
    empresa_id in (
      select empresa_id from public.empresa_usuarios where user_id = auth.uid()
    )
  );

-- productos: solo de la empresa del usuario
create policy "ver productos empresa" on public.productos
  for all using (
    empresa_id in (
      select empresa_id from public.empresa_usuarios where user_id = auth.uid()
    )
  );

-- comprobantes: solo de la empresa del usuario
create policy "ver comprobantes empresa" on public.comprobantes
  for all using (
    empresa_id in (
      select empresa_id from public.empresa_usuarios where user_id = auth.uid()
    )
  );

-- comprobante_items: a través del comprobante
create policy "ver items empresa" on public.comprobante_items
  for all using (
    comprobante_id in (
      select c.id from public.comprobantes c
      join public.empresa_usuarios eu on eu.empresa_id = c.empresa_id
      where eu.user_id = auth.uid()
    )
  );

-- =============================================
-- DATOS DE EJEMPLO (descomentar para usar)
-- =============================================

-- insert into public.empresas (ruc, razon_social, direccion, serie_factura, serie_boleta)
-- values ('20600000001', 'MI EMPRESA SAC', 'Av. Lima 123, Lima', 'F001', 'B001');

-- Luego de registrar un usuario en Auth, vincular así:
-- insert into public.empresa_usuarios (empresa_id, user_id, rol)
-- values ('<empresa_id>', '<user_id>', 'admin');

-- =============================================
-- STORAGE BUCKET para XML/CDR
-- =============================================
-- Ejecutar también en SQL Editor:
-- insert into storage.buckets (id, name, public) values ('comprobantes', 'comprobantes', false);
