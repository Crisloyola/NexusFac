export interface NubefactItem {
  unidad_de_medida: string
  codigo: string
  descripcion: string
  cantidad: number
  valor_unitario: number
  precio_unitario: number
  subtotal: number
  tipo_de_igv: number
  igv: number
  total: number
  anticipo_regularizacion: boolean
}

export interface NubefactPayload {
  operacion: 'generar_comprobante'
  tipo_de_comprobante: number
  serie: string
  numero: number
  sunat_transaction: number
  cliente_tipo_de_documento: string
  cliente_numero_de_documento: string
  cliente_denominacion: string
  cliente_direccion: string
  cliente_email: string
  fecha_de_emision: string
  moneda: number
  porcentaje_de_igv: number
  total_gravada: number
  total_inafecta: string
  total_exonerada: string
  total_igv: number
  total_gratuita: string
  total_otros_cargos: string
  total: number
  detraccion: boolean
  observaciones: string
  enviar_automaticamente_a_la_sunat: boolean
  enviar_automaticamente_al_cliente: boolean
  items: NubefactItem[]
}

export interface NubefactResponse {
  aceptada_por_sunat: boolean
  codigo_hash: string
  enlace_del_pdf: string
  enlace_del_xml: string
  enlace_del_cdr: string
  sunat_description: string
  sunat_note: string
  sunat_responsecode: string
  cadena_para_codigo_qr: string
}

// Nubefact requiere fecha en formato DD-MM-YYYY
function formatFechaNubefact(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-')
  return `${dia}-${mes}-${anio}`
}

export function buildNubefactPayload(opts: {
  tipo: '01' | '03'
  serie: string
  numero: number
  fecha: string
  cliente: {
    tipo_documento: string
    ruc_dni: string
    nombre: string
    direccion?: string | null
    email?: string | null
  }
  items: Array<{
    descripcion: string
    cantidad: number
    precio_unitario: number   // sin IGV
    precio_con_igv: number    // con IGV
    subtotal: number
    igv: number
    total: number
    unidad: string
    codigo?: string | null
  }>
  subtotal: number
  igv: number
  total: number
  observaciones?: string
}): NubefactPayload {
  return {
    operacion: 'generar_comprobante',
    // 1 = Factura, 2 = Boleta (según doc Nubefact)
    tipo_de_comprobante: opts.tipo === '01' ? 1 : 2,
    serie: opts.serie,
    numero: opts.numero,
    sunat_transaction: 1,
    cliente_tipo_de_documento: opts.cliente.tipo_documento,
    cliente_numero_de_documento: opts.cliente.ruc_dni,
    cliente_denominacion: opts.cliente.nombre,
    cliente_direccion: opts.cliente.direccion ?? '',
    cliente_email: opts.cliente.email ?? '',
    // Formato requerido por Nubefact: DD-MM-YYYY
    fecha_de_emision: formatFechaNubefact(opts.fecha),
    moneda: 1,
    porcentaje_de_igv: 18.00,
    total_gravada: opts.subtotal,
    total_inafecta: '',
    total_exonerada: '',
    total_igv: opts.igv,
    total_gratuita: '',
    total_otros_cargos: '',
    total: opts.total,
    detraccion: false,
    observaciones: opts.observaciones ?? '',
    enviar_automaticamente_a_la_sunat: true,
    enviar_automaticamente_al_cliente: false,
    items: opts.items.map(item => ({
      unidad_de_medida: item.unidad,
      codigo: item.codigo ?? '',
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      valor_unitario: item.precio_unitario,   // sin IGV
      precio_unitario: item.precio_con_igv,   // con IGV
      subtotal: item.subtotal,
      tipo_de_igv: 1,
      igv: item.igv,
      total: item.total,
      anticipo_regularizacion: false,
    })),
  }
}

export async function enviarNubefact(
  token: string,
  payload: NubefactPayload
): Promise<NubefactResponse> {
  // NUBEFACT_URL es la RUTA completa por cuenta, ej:
  // https://demo.nubefact.com/api/v1/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const url = process.env.NUBEFACT_URL!

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Nubefact usa el token directo, sin prefijo "Token"
      Authorization: token,
    },
    body: JSON.stringify(payload),
  })

  const data = await res.json()

  if (!res.ok) {
    const errMsg = Array.isArray(data.errors)
      ? data.errors.join(', ')
      : (data.errors ?? data.error ?? `Error HTTP ${res.status}`)
    throw new Error(errMsg)
  }

  return data as NubefactResponse
}
