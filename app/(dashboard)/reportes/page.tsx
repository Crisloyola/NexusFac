'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'
import Link from 'next/link'
import type { Comprobante } from '@/types/database'

const TIPO_LABELS: Record<string, string> = {
  '01': 'Factura',
  '03': 'Boleta',
  '07': 'Nota de Crédito',
}

const ESTADO_COLORS: Record<string, string> = {
  aceptado: 'bg-green-100 text-green-700',
  rechazado: 'bg-red-100 text-red-600',
  enviado: 'bg-blue-100 text-blue-600',
  borrador: 'bg-gray-100 text-gray-600',
  anulado: 'bg-orange-100 text-orange-600',
}

const MESES = [
  { value: '01', label: 'Enero' }, { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' }, { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' }, { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' }, { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' }, { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
]

export default function ReportesPage() {
  const supabase = createClient()
  const now = new Date()
  const [mes, setMes] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [anio, setAnio] = useState(String(now.getFullYear()))
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([])
  const [loading, setLoading] = useState(true)

  const anios = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i))

  const getEmpresaId = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase
      .from('empresa_usuarios')
      .select('empresa_id')
      .eq('user_id', user.id)
      .single()
    return data?.empresa_id ?? null
  }, [supabase])

  const fetchReporte = useCallback(async () => {
    setLoading(true)
    const empresaId = await getEmpresaId()
    if (!empresaId) { setLoading(false); return }

    const desde = `${anio}-${mes}-01`
    const hasta = new Date(Number(anio), Number(mes), 0).toISOString().split('T')[0]

    const { data } = await supabase
      .from('comprobantes')
      .select('*, clientes(nombre, ruc_dni)')
      .eq('empresa_id', empresaId)
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .neq('estado', 'borrador')
      .order('fecha', { ascending: true })
      .order('created_at', { ascending: true })

    setComprobantes((data ?? []) as Comprobante[])
    setLoading(false)
  }, [supabase, mes, anio, getEmpresaId])

  useEffect(() => { fetchReporte() }, [fetchReporte])

  const stats = useMemo(() => {
    const validos = comprobantes.filter(c => c.estado !== 'anulado')
    return {
      total: validos.reduce((s, c) => s + Number(c.total), 0),
      igv: validos.reduce((s, c) => s + Number(c.igv), 0),
      subtotal: validos.reduce((s, c) => s + Number(c.subtotal), 0),
      facturas: validos.filter(c => c.tipo === '01').length,
      boletas: validos.filter(c => c.tipo === '03').length,
      count: validos.length,
    }
  }, [comprobantes])

  function exportarExcel() {
    const rows = comprobantes.map((c, i) => {
      const cliente = c.clientes as unknown as { nombre: string; ruc_dni: string } | null
      return {
        '#': i + 1,
        'Número': `${c.serie}-${String(c.numero).padStart(8, '0')}`,
        'Tipo': TIPO_LABELS[c.tipo] ?? c.tipo,
        'Fecha': c.fecha,
        'RUC/DNI': cliente?.ruc_dni ?? '',
        'Cliente': cliente?.nombre ?? 'Cliente Varios',
        'Op. Gravadas': Number(c.subtotal),
        'IGV': Number(c.igv),
        'Total': Number(c.total),
        'Estado': c.estado,
      }
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 4 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 13 },
      { wch: 32 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Comprobantes')
    XLSX.writeFile(wb, `reporte-${anio}-${mes}.xlsx`)
  }

  const mesLabel = MESES.find(m => m.value === mes)?.label ?? mes

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-gray-500 text-sm mt-1">Resumen mensual — {mesLabel} {anio}</p>
        </div>
        <button
          onClick={exportarExcel}
          disabled={comprobantes.length === 0 || loading}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all"
        >
          ⬇ Exportar Excel
        </button>
      </div>

      {/* Selector mes/año */}
      <div className="flex gap-3 mb-6">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Mes</label>
          <select
            value={mes}
            onChange={e => setMes(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MESES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Año</label>
          <select
            value={anio}
            onChange={e => setAnio(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {anios.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Total Ventas</p>
          <p className="text-xl font-bold text-blue-900 mt-1">
            S/ {stats.total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">{stats.count} comprobantes</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">IGV Total</p>
          <p className="text-xl font-bold text-gray-700 mt-1">
            S/ {stats.igv.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Base: S/ {stats.subtotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Facturas</p>
          <p className="text-xl font-bold text-gray-700 mt-1">{stats.facturas}</p>
          <p className="text-xs text-gray-400 mt-1">Tipo 01</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Boletas</p>
          <p className="text-xl font-bold text-gray-700 mt-1">{stats.boletas}</p>
          <p className="text-xs text-gray-400 mt-1">Tipo 03</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: 'linear-gradient(90deg,#0c1d6e,#1538d0)' }}>
              <tr>
                <th className="text-left px-4 py-3 font-medium text-white text-xs">Número</th>
                <th className="text-left px-4 py-3 font-medium text-white text-xs">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-white text-xs">Fecha</th>
                <th className="text-left px-4 py-3 font-medium text-white text-xs">Cliente</th>
                <th className="text-right px-4 py-3 font-medium text-white text-xs">Subtotal</th>
                <th className="text-right px-4 py-3 font-medium text-white text-xs">IGV</th>
                <th className="text-right px-4 py-3 font-medium text-white text-xs">Total</th>
                <th className="text-left px-4 py-3 font-medium text-white text-xs">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">Cargando...</td>
                </tr>
              ) : comprobantes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    Sin comprobantes para {mesLabel} {anio}
                  </td>
                </tr>
              ) : comprobantes.map((c, idx) => {
                const cliente = c.clientes as unknown as { nombre: string; ruc_dni: string } | null
                return (
                  <tr key={c.id} className={`hover:bg-blue-50 transition-colors ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/comprobantes/${c.id}`}
                        className="font-mono font-semibold text-blue-700 hover:underline"
                      >
                        {c.serie}-{String(c.numero).padStart(8, '0')}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{TIPO_LABELS[c.tipo] ?? c.tipo}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(c.fecha + 'T00:00:00').toLocaleDateString('es-PE')}
                    </td>
                    <td className="px-4 py-3 text-gray-800 max-w-[220px] truncate">
                      {cliente?.nombre ?? 'Cliente Varios'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">S/ {Number(c.subtotal).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">S/ {Number(c.igv).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">S/ {Number(c.total).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ESTADO_COLORS[c.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                        {c.estado}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!loading && comprobantes.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 flex justify-end gap-6 text-sm text-gray-600 bg-gray-50/80">
            <span>Op. Gravadas: <span className="font-semibold text-gray-800">S/ {stats.subtotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span></span>
            <span>IGV: <span className="font-semibold text-gray-800">S/ {stats.igv.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span></span>
            <span className="font-bold text-blue-900">Total: S/ {stats.total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
          </div>
        )}
      </div>
    </div>
  )
}
