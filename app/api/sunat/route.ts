import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const numero = searchParams.get('numero')

  if (!numero) return NextResponse.json({ error: 'Falta número' }, { status: 400 })

  const token = process.env.DECOLECTA_TOKEN ?? process.env.APIS_NET_PE_TOKEN

  const tipo = numero.length === 11 ? 'ruc' : 'dni'

  // api.decolecta.com para RUC/DNI
  const url = `https://api.decolecta.com/v1/sunat/${tipo}?numero=${numero}`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const res = await fetch(url, { headers })
    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.message ?? data?.detail ?? 'No encontrado' },
        { status: res.status }
      )
    }

    // Normalizar campos a lo que espera el cliente
    return NextResponse.json({
      razonSocial: data.razon_social ?? data.nombre ?? '',
      nombre: data.nombre ?? data.razon_social ?? '',
      direccion: data.dirección ?? data.direccion ?? '',
      numeroDocumento: data.numero_documento ?? numero,
    })
  } catch {
    return NextResponse.json({ error: 'Error al consultar SUNAT' }, { status: 502 })
  }
}
