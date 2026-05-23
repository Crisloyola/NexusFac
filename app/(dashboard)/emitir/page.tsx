'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { emitirComprobante, guardarBorrador } from '@/app/actions/emitir-comprobante'
import type { Cliente, Producto } from '@/types/database'
import { useRouter } from 'next/navigation'

const IGV_RATE = 0.18

interface LineaItem {
  id: string
  descripcion: string
  cantidad: number
  precio_con_igv: number
  unidad: string
  codigo?: string
}

function calcularItem(item: LineaItem) {
  const precio_unitario = parseFloat((item.precio_con_igv / (1 + IGV_RATE)).toFixed(6))
  const subtotal = parseFloat((precio_unitario * item.cantidad).toFixed(2))
  const igv = parseFloat((item.precio_con_igv * item.cantidad - subtotal).toFixed(2))
  const total = parseFloat((item.precio_con_igv * item.cantidad).toFixed(2))
  return { precio_unitario, subtotal, igv, total }
}

export default function EmitirPage() {
  const supabase = createClient()
  const router = useRouter()

  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [tipo, setTipo] = useState<'01' | '03'>('01')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [clienteSearch, setClienteSearch] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteSelected, setClienteSelected] = useState<Cliente | null>(null)
  const [showClienteList, setShowClienteList] = useState(false)
  const [sunatLoading, setSunatLoading] = useState(false)
  const [sunatMsg, setSunatMsg] = useState('')
  const [productos, setProductos] = useState<Producto[]>([])
  const [items, setItems] = useState<LineaItem[]>([
    { id: crypto.randomUUID(), descripcion: '', cantidad: 1, precio_con_igv: 0, unidad: 'NIU' },
  ])
  const [observaciones, setObservaciones] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const getEmpresaId = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase.from('empresa_usuarios').select('empresa_id').eq('user_id', user.id).single()
    return data?.empresa_id ?? null
  }, [supabase])

  useEffect(() => {
    getEmpresaId().then(id => {
      setEmpresaId(id)
      if (!id) return
      supabase.from('productos').select('*').eq('empresa_id', id).eq('activo', true).order('nombre')
        .then(({ data }) => setProductos(data ?? []))
    })
  }, [getEmpresaId, supabase])

  useEffect(() => {
    if (!empresaId || clienteSearch.length < 2) { setClientes([]); return }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('clientes')
        .select('*')
        .eq('empresa_id', empresaId)
        .or(`nombre.ilike.%${clienteSearch}%,ruc_dni.ilike.%${clienteSearch}%`)
        .limit(8)
      setClientes(data ?? [])
      setShowClienteList(true)
    }, 300)
    return () => clearTimeout(timeout)
  }, [clienteSearch, empresaId, supabase])

  function selectCliente(c: Cliente) {
    setClienteSelected(c)
    setClienteId(c.id)
    setClienteSearch(c.nombre)
    setShowClienteList(false)
    setSunatMsg('')
  }

  async function buscarEnSUNAT() {
    const doc = clienteSearch.trim()
    if (!doc || (doc.length !== 11 && doc.length !== 8)) {
      setSunatMsg('Ingresa un RUC (11 dígitos) o DNI (8 dígitos)')
      return
    }
    if (!empresaId) return
    setSunatLoading(true)
    setSunatMsg('')
    try {
      const res = await fetch(`/api/sunat?numero=${doc}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No encontrado')
      const nombre = data.razonSocial ?? data.nombre ?? ''
      const direccion = data.direccion ?? ''
      const tipo_documento = doc.length === 11 ? '6' : '1'

      // Guardar en BD si no existe
      const { data: existing } = await supabase
        .from('clientes')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('ruc_dni', doc)
        .single()

      if (existing) {
        selectCliente(existing as Cliente)
        setSunatMsg('Cliente ya registrado — seleccionado automáticamente')
      } else {
        const { data: nuevo, error } = await supabase
          .from('clientes')
          .insert({ empresa_id: empresaId, tipo_documento, ruc_dni: doc, nombre, direccion })
          .select()
          .single()
        if (error) throw new Error(error.message)
        selectCliente(nuevo as Cliente)
        setSunatMsg('Cliente encontrado en SUNAT y guardado en tu lista')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al consultar'
      setSunatMsg(`No encontrado: ${msg}`)
    }
    setSunatLoading(false)
  }

  function addItem(producto?: Producto) {
    const precio = producto
      ? producto.igv_incluido
        ? Number(producto.precio)
        : Number(producto.precio) * 1.18
      : 0
    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      descripcion: producto?.nombre ?? '',
      cantidad: 1,
      precio_con_igv: parseFloat(precio.toFixed(2)),
      unidad: producto?.unidad ?? 'NIU',
      codigo: producto?.codigo ?? undefined,
    }])
  }

  function updateItem(id: string, field: keyof LineaItem, value: string | number) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it))
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(it => it.id !== id))
  }

  const totales = items.reduce(
    (acc, item) => {
      const { subtotal, igv, total } = calcularItem(item)
      return {
        subtotal: acc.subtotal + subtotal,
        igv: acc.igv + igv,
        total: acc.total + total,
      }
    },
    { subtotal: 0, igv: 0, total: 0 }
  )

  function buildPayload() {
    if (!empresaId) throw new Error('Sin empresa')
    return {
      empresa_id: empresaId,
      cliente_id: clienteId,
      tipo,
      fecha,
      items: items.map(item => {
        const { precio_unitario, subtotal, igv, total } = calcularItem(item)
        return {
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          precio_unitario,
          precio_con_igv: item.precio_con_igv,
          subtotal,
          igv,
          total,
          unidad: item.unidad,
          codigo: item.codigo,
        }
      }),
      subtotal: parseFloat(totales.subtotal.toFixed(2)),
      igv: parseFloat(totales.igv.toFixed(2)),
      total: parseFloat(totales.total.toFixed(2)),
      observaciones,
    }
  }

  async function handleEmitir() {
    if (!empresaId) return
    if (tipo === '01' && !clienteSelected) {
      setResult({ ok: false, msg: 'Las facturas requieren RUC del cliente' })
      return
    }
    if (items.some(i => !i.descripcion || i.precio_con_igv <= 0)) {
      setResult({ ok: false, msg: 'Completa todos los ítems antes de emitir' })
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await emitirComprobante(buildPayload())
      if (res.ok) {
        setResult({ ok: true, msg: `${tipo === '01' ? 'Factura' : 'Boleta'} ${res.serie}-${String(res.numero).padStart(8, '0')} emitida y aceptada por SUNAT` })
        setTimeout(() => router.push('/comprobantes'), 2000)
      } else {
        setResult({ ok: false, msg: res.error ?? 'Error al emitir' })
      }
    } catch (e) {
      setResult({ ok: false, msg: String(e) })
    }
    setLoading(false)
  }

  async function handleBorrador() {
    if (!empresaId) return
    setLoading(true)
    setResult(null)
    try {
      const res = await guardarBorrador(buildPayload())
      if (res.ok) {
        setResult({ ok: true, msg: `Borrador guardado: ${res.serie}-${String(res.numero).padStart(8, '0')}` })
        setTimeout(() => router.push('/comprobantes'), 1500)
      } else {
        setResult({ ok: false, msg: res.error ?? 'Error al guardar' })
      }
    } catch (e) {
      setResult({ ok: false, msg: String(e) })
    }
    setLoading(false)
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Emitir Comprobante</h1>
        <p className="text-gray-500 text-sm mt-1">Completa los datos y emite a SUNAT</p>
      </div>

      {result && (
        <div className={`mb-5 px-4 py-3 rounded-lg text-sm font-medium ${result.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
          {result.msg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">

          {/* Tipo de comprobante */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Tipo de comprobante</h2>
            <div className="flex gap-3">
              {([['01', 'Factura', 'F001 — Requiere RUC'], ['03', 'Boleta', 'B001 — DNI o sin doc.']] as const).map(([val, label, desc]) => (
                <button
                  key={val}
                  onClick={() => setTipo(val)}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 text-left transition-all ${tipo === val ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <p className={`font-semibold text-sm ${tipo === val ? 'text-blue-700' : 'text-gray-700'}`}>{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Fecha */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="text-sm font-medium text-gray-700">Fecha de emisión</label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Cliente */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800">
                Cliente
                {tipo === '01'
                  ? <span className="text-red-500 text-xs ml-2">* RUC obligatorio para factura</span>
                  : <span className="text-gray-400 text-xs ml-2">opcional — si no eliges, emite a "Cliente Varios"</span>
                }
              </h2>
              {clienteSelected && (
                <button
                  onClick={() => { setClienteSelected(null); setClienteId(null); setClienteSearch('') }}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  ✕ Quitar
                </button>
              )}
            </div>

            {!clienteSelected ? (
              <div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={clienteSearch}
                      onChange={e => {
                        setClienteSearch(e.target.value)
                        setClienteSelected(null)
                        setClienteId(null)
                        setSunatMsg('')
                      }}
                      placeholder="RUC, DNI o nombre del cliente..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyDown={e => e.key === 'Enter' && buscarEnSUNAT()}
                    />
                    {showClienteList && clientes.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1 divide-y divide-gray-100">
                        {clientes.map(c => (
                          <button
                            key={c.id}
                            onClick={() => selectCliente(c)}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm"
                          >
                            <p className="font-medium text-gray-800">{c.nombre}</p>
                            <p className="text-xs text-gray-400">{c.tipo_documento === '6' ? 'RUC' : 'DNI'}: {c.ruc_dni}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={buscarEnSUNAT}
                    disabled={sunatLoading}
                    className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-all whitespace-nowrap"
                    style={{ background: sunatLoading ? '#7eb8fa' : 'linear-gradient(135deg,#0c1d6e,#1a56db)' }}
                  >
                    {sunatLoading ? 'Buscando...' : 'Buscar en SUNAT'}
                  </button>
                </div>

                {sunatMsg && (
                  <p className={`mt-2 text-xs font-medium ${sunatMsg.includes('No se encontró') ? 'text-red-500' : 'text-green-600'}`}>
                    {sunatMsg}
                  </p>
                )}

                {tipo === '03' && (
                  <p className="mt-2 text-xs text-gray-400">
                    Si dejas vacío, emite a <span className="font-medium text-gray-500">CLIENTE VARIOS</span> (válido para boletas).
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                <p className="text-sm font-semibold text-blue-900">{clienteSelected.nombre}</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  {clienteSelected.tipo_documento === '6' ? 'RUC' : 'DNI'}: {clienteSelected.ruc_dni}
                  {clienteSelected.direccion ? ` — ${clienteSelected.direccion}` : ''}
                </p>
              </div>
            )}
          </div>

          {/* Ítems */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Ítems</h2>
              <div className="flex gap-2">
                <select
                  onChange={e => {
                    const prod = productos.find(p => p.id === e.target.value)
                    if (prod) addItem(prod)
                    e.target.value = ''
                  }}
                  defaultValue=""
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>+ Desde catálogo</option>
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre} — S/ {Number(p.precio).toFixed(2)}</option>
                  ))}
                </select>
                <button
                  onClick={() => addItem()}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                >
                  + Línea libre
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => {
                const { subtotal, igv, total } = calcularItem(item)
                return (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-5">
                        <label className="text-xs text-gray-500">Descripción</label>
                        <input
                          value={item.descripcion}
                          onChange={e => updateItem(item.id, 'descripcion', e.target.value)}
                          className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Descripción del producto/servicio"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-gray-500">Cantidad</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.cantidad}
                          onChange={e => updateItem(item.id, 'cantidad', parseFloat(e.target.value) || 0)}
                          className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-gray-500">P. Unit (c/IGV)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.precio_con_igv}
                          onChange={e => updateItem(item.id, 'precio_con_igv', parseFloat(e.target.value) || 0)}
                          className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="col-span-2 text-right">
                        <label className="text-xs text-gray-500">Total</label>
                        <p className="mt-2 text-sm font-semibold text-gray-800">S/ {total.toFixed(2)}</p>
                        <p className="text-xs text-gray-400">IGV: {igv.toFixed(2)}</p>
                      </div>
                      <div className="col-span-1 pt-5 text-right">
                        {idx > 0 && (
                          <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      Subtotal sin IGV: S/ {subtotal.toFixed(2)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Observaciones */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="text-sm font-medium text-gray-700">Observaciones (opcional)</label>
            <textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              rows={2}
              className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Observaciones adicionales para el comprobante..."
            />
          </div>
        </div>

        {/* Right column — Totales y acciones */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-6">
            <h2 className="font-semibold text-gray-800 mb-4">Resumen</h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal (sin IGV)</span>
                <span>S/ {totales.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>IGV (18%)</span>
                <span>S/ {totales.igv.toFixed(2)}</span>
              </div>
              <div className="h-px bg-gray-200 my-2" />
              <div className="flex justify-between font-bold text-gray-900 text-base">
                <span>Total</span>
                <span>S/ {totales.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <button
                onClick={handleEmitir}
                disabled={loading}
                className="w-full text-white text-sm font-semibold py-3 rounded-xl transition-all"
                style={{ background: loading ? '#7eb8fa' : 'linear-gradient(135deg,#0c1d6e,#1a56db)' }}
              >
                {loading ? 'Procesando...' : '⚡ Emitir a SUNAT'}
              </button>
              <button
                onClick={handleBorrador}
                disabled={loading}
                className="w-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 text-sm font-medium py-3 rounded-xl transition-colors"
              >
                Guardar borrador
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
