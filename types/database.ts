export type TipoComprobante = '01' | '03' | '07'
export type EstadoComprobante = 'borrador' | 'enviado' | 'aceptado' | 'rechazado' | 'anulado'
export type RolUsuario = 'admin' | 'vendedor'
export type TipoDocumento = '6' | '1'

export interface Empresa {
  id: string
  ruc: string
  razon_social: string
  nombre_comercial: string | null
  direccion: string
  ubigeo: string | null
  logo_url: string | null
  nubefact_token: string | null
  serie_factura: string
  serie_boleta: string
  correlativo_factura: number
  correlativo_boleta: number
  created_at: string
  updated_at: string
}

export interface EmpresaUsuario {
  id: string
  empresa_id: string
  user_id: string
  rol: RolUsuario
  created_at: string
}

export interface Cliente {
  id: string
  empresa_id: string
  tipo_documento: TipoDocumento
  ruc_dni: string
  nombre: string
  direccion: string | null
  email: string | null
  telefono: string | null
  created_at: string
  updated_at: string
}

export interface Producto {
  id: string
  empresa_id: string
  codigo: string | null
  nombre: string
  descripcion: string | null
  precio: number
  unidad: string
  igv_incluido: boolean
  activo: boolean
  created_at: string
  updated_at: string
}

export interface Comprobante {
  id: string
  empresa_id: string
  cliente_id: string | null
  tipo: TipoComprobante
  serie: string
  numero: number
  fecha: string
  moneda: string
  tipo_operacion: string
  subtotal: number
  igv: number
  total: number
  estado: EstadoComprobante
  xml_url: string | null
  cdr_url: string | null
  hash_cdr: string | null
  nubefact_response: Record<string, unknown> | null
  observaciones: string | null
  created_at: string
  updated_at: string
  clientes?: Cliente
  comprobante_items?: ComprobanteItem[]
}

export interface ComprobanteItem {
  id: string
  comprobante_id: string
  orden: number
  codigo: string | null
  descripcion: string
  unidad: string
  cantidad: number
  precio_unitario: number
  precio_con_igv: number
  subtotal: number
  igv: number
  total: number
  tipo_afectacion: string
}
