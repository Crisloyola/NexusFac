import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ComprobanteDetalle from './ComprobanteDetalle'

export default async function ComprobantePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: comprobante } = await supabase
    .from('comprobantes')
    .select('*, clientes(*), comprobante_items(*)')
    .eq('id', id)
    .single()

  if (!comprobante) notFound()

  const { data: eu } = await supabase
    .from('empresa_usuarios')
    .select('empresa_id')
    .eq('empresa_id', comprobante.empresa_id)
    .single()

  const { data: empresa } = await supabase
    .from('empresas')
    .select('*')
    .eq('id', comprobante.empresa_id)
    .single()

  if (!empresa) notFound()

  return (
    <ComprobanteDetalle
      comprobante={comprobante}
      empresa={empresa}
    />
  )
}
