import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const BUCKET = 'logos'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const empresaId = formData.get('empresa_id') as string | null

    if (!file || !empresaId) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo no debe superar 2 MB' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    const ext = (file.name.split('.').pop() ?? 'png').toLowerCase()
    const path = `${empresaId}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { upsert: true, contentType: file.type })

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)

    // Añadir cache-buster para forzar recarga en el browser
    const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`

    await supabase
      .from('empresas')
      .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', empresaId)

    return NextResponse.json({ ok: true, url: publicUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
