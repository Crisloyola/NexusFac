'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Comprobante } from '@/types/database'
import Link from 'next/link'

const estadoColors: Record<string, string> = {
  aceptado: 'bg-green-100 text-green-700',
  rechazado: 'bg-red-100 text-red-600',
  enviado:   'bg-blue-100 text-blue-600',
  borrador:  'bg-gray-100 text-gray-600',
  anulado:   'bg-orange-100 text-orange-600',
}

export default function ComprobantesPage() {
  const supabase = createClient()
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([])
  const [loading, setLoading]           = useState(true)
  const [filtroTipo, setFiltroTipo]     = useState<'' | '01' | '03'>('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')
  const [busqueda, setBusqueda]         = useState('')
  const [pagina, setPagina]             = useState(1)
  const POR_PAGINA = 9

  const getEmpresaId = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase.from('empresa_usuarios').select('empresa_id').eq('user_id', user.id).single()
    return data?.empresa_id ?? null
  }, [supabase])

  const fetchComprobantes = useCallback(async () => {
    setLoading(true)
    const empresaId = await getEmpresaId()
    if (!empresaId) return

    let q = supabase
      .from('comprobantes')
      .select('*, clientes(nombre, ruc_dni)')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .limit(500)

    if (filtroTipo)        q = q.eq('tipo', filtroTipo)
    if (filtroEstado)      q = q.eq('estado', filtroEstado)
    if (filtroFechaDesde)  q = q.gte('fecha', filtroFechaDesde)
    if (filtroFechaHasta)  q = q.lte('fecha', filtroFechaHasta)

    const { data } = await q
    setComprobantes((data ?? []) as Comprobante[])
    setLoading(false)
  }, [supabase, filtroTipo, filtroEstado, filtroFechaDesde, filtroFechaHasta, getEmpresaId])

  useEffect(() => { fetchComprobantes() }, [fetchComprobantes])

  // Filtro por nombre de cliente (client-side)
  const lista = useMemo(() => {
    if (!busqueda.trim()) return comprobantes
    const q = busqueda.toLowerCase()
    return comprobantes.filter(c => {
      const cliente = c.clientes as unknown as { nombre: string; ruc_dni: string } | null
      return (
        (cliente?.nombre ?? '').toLowerCase().includes(q) ||
        (cliente?.ruc_dni ?? '').includes(q) ||
        `${c.serie}-${String(c.numero).padStart(8, '0')}`.toLowerCase().includes(q)
      )
    })
  }, [comprobantes, busqueda])

  const total = useMemo(() => lista.reduce((s, c) => s + Number(c.total), 0), [lista])

  // Reset page when filters change
  useEffect(() => { setPagina(1) }, [busqueda, filtroTipo, filtroEstado, filtroFechaDesde, filtroFechaHasta])

  const totalPaginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA))
  const paginada = lista.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  function limpiarFiltros() {
    setFiltroTipo('')
    setFiltroEstado('')
    setFiltroFechaDesde('')
    setFiltroFechaHasta('')
    setBusqueda('')
  }

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comprobantes</h1>
          <p className="text-gray-500 text-sm mt-1">Historial completo de facturas y boletas</p>
        </div>
        <Link
          href="/emitir"
          className="text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all"
          style={{ background: 'linear-gradient(135deg,#0c1d6e,#1a56db)' }}
        >
          + Emitir
        </Link>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">

          {/* Búsqueda por cliente */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-gray-600 block mb-1">Buscar cliente o número</label>
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Nombre, RUC/DNI o serie-número..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Tipo</label>
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as '' | '01' | '03')}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todos</option>
              <option value="01">Factura</option>
              <option value="03">Boleta</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Estado</label>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todos</option>
              <option value="aceptado">Aceptado</option>
              <option value="rechazado">Rechazado</option>
              <option value="borrador">Borrador</option>
              <option value="anulado">Anulado</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Desde</label>
            <input type="date" value={filtroFechaDesde} onChange={e => setFiltroFechaDesde(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Hasta</label>
            <input type="date" value={filtroFechaHasta} onChange={e => setFiltroFechaHasta(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <button onClick={limpiarFiltros}
            className="px-3 py-2 text-gray-500 hover:text-red-500 text-sm transition-colors">
            ✕ Limpiar
          </button>
        </div>
      </div>

      {/* Resumen */}
      <div className="flex gap-4 mb-3 text-sm text-gray-500">
        <span><span className="font-semibold text-gray-800">{lista.length}</span> comprobantes</span>
        <span>·</span>
        <span>Total: <span className="font-semibold text-gray-800">S/ {total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span></span>
        {busqueda && <span className="text-blue-600">· Filtrando por: "{busqueda}"</span>}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: 'linear-gradient(90deg,#0c1d6e,#1538d0)' }}>
              <tr>
                <th className="text-center px-4 py-3 font-medium text-white text-xs w-10">#</th>
                <th className="text-left px-4 py-3 font-medium text-white text-xs">Número</th>
                <th className="text-left px-4 py-3 font-medium text-white text-xs">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-white text-xs">Fecha</th>
                <th className="text-right px-4 py-3 font-medium text-white text-xs">Subtotal</th>
                <th className="text-right px-4 py-3 font-medium text-white text-xs">IGV</th>
                <th className="text-right px-4 py-3 font-medium text-white text-xs">Total</th>
                <th className="text-left px-4 py-3 font-medium text-white text-xs">Estado</th>
                <th className="px-4 py-3 text-xs text-white"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">Cargando...</td></tr>
              ) : lista.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">No hay comprobantes con los filtros aplicados</td></tr>
              ) : paginada.map((c, idx) => {
                const cliente = c.clientes as unknown as { nombre: string; ruc_dni: string } | null
                return (
                  <tr key={c.id} className={`hover:bg-blue-50 transition-colors ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                    {/* # */}
                    <td className="px-4 py-3.5 text-center text-xs text-gray-400 font-mono">{(pagina - 1) * POR_PAGINA + idx + 1}</td>

                    {/* Número */}
                    <td className="px-4 py-3.5">
                      <p className="font-mono font-semibold text-blue-700">
                        {c.serie}-{String(c.numero).padStart(8, '0')}
                      </p>
                      <p className="text-xs text-gray-400">{c.tipo === '01' ? 'Factura' : 'Boleta'}</p>
                    </td>

                    {/* Cliente */}
                    <td className="px-4 py-3.5 max-w-[220px]">
                      <p className="text-gray-800 truncate">{cliente?.nombre ?? 'Cliente Varios'}</p>
                      <p className="text-xs text-gray-400">{cliente?.ruc_dni ?? ''}</p>
                    </td>

                    {/* Fecha */}
                    <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">
                      {new Date(c.fecha + 'T00:00:00').toLocaleDateString('es-PE')}
                    </td>

                    {/* Subtotal */}
                    <td className="px-4 py-3.5 text-right text-gray-600">S/ {Number(c.subtotal).toFixed(2)}</td>

                    {/* IGV */}
                    <td className="px-4 py-3.5 text-right text-gray-600">S/ {Number(c.igv).toFixed(2)}</td>

                    {/* Total */}
                    <td className="px-4 py-3.5 text-right font-bold text-gray-900">S/ {Number(c.total).toFixed(2)}</td>

                    {/* Estado */}
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${estadoColors[c.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                        {c.estado}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <Link href={`/comprobantes/${c.id}`}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                        Ver →
                      </Link>
                      {c.xml_url && (
                        <a href={c.xml_url} target="_blank" rel="noreferrer"
                          className="ml-3 text-gray-400 hover:text-gray-700 text-xs">
                          XML
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-sm text-gray-500">
            Mostrando <span className="font-semibold text-gray-700">{(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, lista.length)}</span> de <span className="font-semibold text-gray-700">{lista.length}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPagina(1)}
              disabled={pagina === 1}
              className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              «
            </button>
            <button
              onClick={() => setPagina(p => Math.max(1, p - 1))}
              disabled={pagina === 1}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>

            {Array.from({ length: totalPaginas }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPaginas || Math.abs(p - pagina) <= 1)
              .reduce<(number | '...')[]>((acc, p, i, arr) => {
                if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('...')
                acc.push(p)
                return acc
              }, [])
              .map((p, i) =>
                p === '...' ? (
                  <span key={`dots-${i}`} className="px-2 py-1.5 text-xs text-gray-400">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPagina(p as number)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${pagina === p ? 'text-white border-transparent' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    style={pagina === p ? { background: 'linear-gradient(135deg,#0c1d6e,#1a56db)' } : {}}
                  >
                    {p}
                  </button>
                )
              )}

            <button
              onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
              disabled={pagina === totalPaginas}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
            </button>
            <button
              onClick={() => setPagina(totalPaginas)}
              disabled={pagina === totalPaginas}
              className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
