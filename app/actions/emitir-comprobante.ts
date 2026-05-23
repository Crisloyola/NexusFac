'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { buildNubefactPayload, enviarNubefact } from '@/lib/nubefact'
import type { ComprobanteItem } from '@/types/database'

export interface EmitirPayload {
  empresa_id: string
  cliente_id: string | null
  tipo: '01' | '03'
  fecha: string
  items: Array<{
    descripcion: string
    cantidad: number
    precio_unitario: number
    precio_con_igv: number
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
}

export interface EmitirResult {
  ok: boolean
  comprobante_id?: string
  error?: string
  numero?: number
  serie?: string
}

export async function emitirComprobante(payload: EmitirPayload): Promise<EmitirResult> {
  const supabase = await createServiceClient()

  // 1. Obtener empresa con token Nubefact y correlativo
  const { data: empresa, error: eErr } = await supabase
    .from('empresas')
    .select('*')
    .eq('id', payload.empresa_id)
    .single()

  if (eErr || !empresa) return { ok: false, error: 'Empresa no encontrada' }
  if (!empresa.nubefact_token) return { ok: false, error: 'Token Nubefact no configurado en la empresa' }

  // 2. Obtener siguiente correlativo (atómico)
  const { data: numeroRaw, error: cErr } = await supabase
    .rpc('get_next_correlativo', { p_empresa_id: payload.empresa_id, p_tipo: payload.tipo })

  if (cErr || !numeroRaw) return { ok: false, error: 'Error al obtener correlativo' }
  const numero = Number(numeroRaw)
  const serie = payload.tipo === '01' ? empresa.serie_factura : empresa.serie_boleta

  // 3. Obtener cliente si hay cliente_id
  let cliente = {
    tipo_documento: '6',
    ruc_dni: '00000000',
    nombre: 'CLIENTE VARIOS',
    direccion: null as string | null,
    email: null as string | null,
  }

  if (payload.cliente_id) {
    const { data: clienteData } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', payload.cliente_id)
      .single()
    if (clienteData) cliente = clienteData
  }

  // 4. Crear borrador en DB
  const { data: comprobante, error: insErr } = await supabase
    .from('comprobantes')
    .insert({
      empresa_id: payload.empresa_id,
      cliente_id: payload.cliente_id,
      tipo: payload.tipo,
      serie,
      numero,
      fecha: payload.fecha,
      subtotal: payload.subtotal,
      igv: payload.igv,
      total: payload.total,
      estado: 'borrador',
      observaciones: payload.observaciones,
    })
    .select()
    .single()

  if (insErr || !comprobante) return { ok: false, error: insErr?.message ?? 'Error al crear comprobante' }

  // 5. Insertar items
  const itemsToInsert: Partial<ComprobanteItem>[] = payload.items.map((item, i) => ({
    comprobante_id: comprobante.id,
    orden: i + 1,
    descripcion: item.descripcion,
    cantidad: item.cantidad,
    precio_unitario: item.precio_unitario,
    precio_con_igv: item.precio_con_igv,
    subtotal: item.subtotal,
    igv: item.igv,
    total: item.total,
    unidad: item.unidad,
    codigo: item.codigo,
  }))

  await supabase.from('comprobante_items').insert(itemsToInsert)

  // 6. Enviar a Nubefact
  const nubefactPayload = buildNubefactPayload({
    tipo: payload.tipo,
    serie,
    numero,
    fecha: payload.fecha,
    cliente,
    items: payload.items,
    subtotal: payload.subtotal,
    igv: payload.igv,
    total: payload.total,
  })

  try {
    const nubefactRes = await enviarNubefact(empresa.nubefact_token, nubefactPayload)

    await supabase
      .from('comprobantes')
      .update({
        estado: nubefactRes.aceptada_por_sunat ? 'aceptado' : 'rechazado',
        xml_url: nubefactRes.enlace_del_xml,
        cdr_url: nubefactRes.enlace_del_cdr,
        hash_cdr: nubefactRes.codigo_hash,
        nubefact_response: nubefactRes as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq('id', comprobante.id)

    return {
      ok: true,
      comprobante_id: comprobante.id,
      numero,
      serie,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al enviar a Nubefact'
    await supabase
      .from('comprobantes')
      .update({ estado: 'rechazado', nubefact_response: { error: msg } as Record<string, unknown> })
      .eq('id', comprobante.id)

    return { ok: false, error: msg, comprobante_id: comprobante.id }
  }
}

export async function guardarBorrador(payload: EmitirPayload): Promise<EmitirResult> {
  const supabase = await createServiceClient()

  const { data: empresa } = await supabase
    .from('empresas')
    .select('serie_factura, serie_boleta')
    .eq('id', payload.empresa_id)
    .single()

  if (!empresa) return { ok: false, error: 'Empresa no encontrada' }

  const { data: numeroRaw } = await supabase
    .rpc('get_next_correlativo', { p_empresa_id: payload.empresa_id, p_tipo: payload.tipo })

  const numero = Number(numeroRaw)
  const serie = payload.tipo === '01' ? empresa.serie_factura : empresa.serie_boleta

  const { data: comprobante, error } = await supabase
    .from('comprobantes')
    .insert({
      empresa_id: payload.empresa_id,
      cliente_id: payload.cliente_id,
      tipo: payload.tipo,
      serie,
      numero,
      fecha: payload.fecha,
      subtotal: payload.subtotal,
      igv: payload.igv,
      total: payload.total,
      estado: 'borrador',
      observaciones: payload.observaciones,
    })
    .select()
    .single()

  if (error || !comprobante) return { ok: false, error: error?.message ?? 'Error al guardar' }

  const itemsToInsert = payload.items.map((item, i) => ({
    comprobante_id: comprobante.id,
    orden: i + 1,
    ...item,
  }))
  await supabase.from('comprobante_items').insert(itemsToInsert)

  return { ok: true, comprobante_id: comprobante.id, numero, serie }
}
