'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Producto } from '@/types/database'

export default function ProductosPage() {
  const supabase = createClient()
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm]           = useState<Partial<Producto>>({ igv_incluido: true, unidad: 'NIU', activo: true })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const getEmpresaId = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase.from('empresa_usuarios').select('empresa_id').eq('user_id', user.id).single()
    return data?.empresa_id ?? null
  }, [supabase])

  const fetchProductos = useCallback(async () => {
    setLoading(true)
    const empresaId = await getEmpresaId()
    if (!empresaId) return
    const { data } = await supabase.from('productos').select('*').eq('empresa_id', empresaId).order('nombre')
    setProductos(data ?? [])
    setLoading(false)
  }, [supabase, getEmpresaId])

  useEffect(() => { fetchProductos() }, [fetchProductos])

  async function handleSave() {
    setSaving(true); setError('')
    const empresaId = await getEmpresaId()
    if (!empresaId) return
    const payload = { ...form, empresa_id: empresaId }
    if (editingId) {
      const { error } = await supabase.from('productos').update(payload).eq('id', editingId)
      if (error) { setError(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('productos').insert(payload)
      if (error) { setError(error.message); setSaving(false); return }
    }
    setShowForm(false); setForm({ igv_incluido: true, unidad: 'NIU', activo: true }); setEditingId(null)
    fetchProductos(); setSaving(false)
  }

  async function toggleActivo(p: Producto) {
    await supabase.from('productos').update({ activo: !p.activo }).eq('id', p.id)
    fetchProductos()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este producto?')) return
    await supabase.from('productos').delete().eq('id', id)
    fetchProductos()
  }

  function openEdit(p: Producto) { setForm(p); setEditingId(p.id); setShowForm(true) }
  function openNew() { setForm({ igv_incluido: true, unidad: 'NIU', activo: true }); setEditingId(null); setShowForm(true) }

  const precioConIGV = (precio: number, incluido: boolean) => incluido ? precio : precio * 1.18

  return (
    <div className="p-6 md:p-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos y Servicios</h1>
          <p className="text-gray-500 text-sm mt-1">Catálogo disponible para facturar</p>
        </div>
        <button onClick={openNew}
          className="text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm"
          style={{ background: 'linear-gradient(135deg,#0c1d6e,#1a56db)' }}>
          + Nuevo producto
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: 'linear-gradient(90deg,#0c1d6e,#1538d0)' }}>
              <tr>
                <th className="text-center px-4 py-3 font-medium text-white text-xs w-10">#</th>
                <th className="text-left px-4 py-3 font-medium text-white text-xs">Código</th>
                <th className="text-left px-4 py-3 font-medium text-white text-xs">Nombre / Servicio</th>
                <th className="text-left px-4 py-3 font-medium text-white text-xs">Unidad</th>
                <th className="text-right px-4 py-3 font-medium text-white text-xs">Precio (c/IGV)</th>
                <th className="text-left px-4 py-3 font-medium text-white text-xs">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Cargando...</td></tr>
              ) : productos.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No hay productos registrados</td></tr>
              ) : productos.map((p, idx) => (
                <tr key={p.id} className={`hover:bg-blue-50 transition-colors ${!p.activo ? 'opacity-50' : ''} ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                  <td className="px-4 py-3.5 text-center text-xs text-gray-400 font-mono">{idx + 1}</td>
                  <td className="px-4 py-3.5 font-mono text-gray-500 text-xs">{p.codigo ?? '—'}</td>
                  <td className="px-4 py-3.5 font-semibold text-gray-800">{p.nombre}</td>
                  <td className="px-4 py-3.5 text-gray-500">{p.unidad}</td>
                  <td className="px-4 py-3.5 text-right font-bold text-gray-900">
                    S/ {precioConIGV(Number(p.precio), p.igv_incluido).toFixed(2)}
                    {!p.igv_incluido && <span className="text-xs text-gray-400 ml-1">(+IGV)</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <button onClick={() => toggleActivo(p)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${p.activo ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-4 py-3.5 text-right space-x-3">
                    <button onClick={() => openEdit(p)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Editar</button>
                    <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4" style={{ background: 'linear-gradient(135deg,#0c1d6e,#1538d0)' }}>
              <h2 className="font-bold text-white text-lg">{editingId ? 'Editar producto' : 'Nuevo producto'}</h2>
            </div>
            <div className="p-6">
              {error && <p className="text-red-500 text-sm mb-4 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Código interno</label>
                    <input value={form.codigo ?? ''} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="PROD-001" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Unidad</label>
                    <select value={form.unidad} onChange={e => setForm(p => ({ ...p, unidad: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="NIU">Unidad (NIU)</option>
                      <option value="ZZ">Servicio (ZZ)</option>
                      <option value="KGM">Kilogramo (KGM)</option>
                      <option value="MTR">Metro (MTR)</option>
                      <option value="LTR">Litro (LTR)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Nombre del producto / servicio</label>
                  <input value={form.nombre ?? ''} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Descripción (opcional)</label>
                  <textarea value={form.descripcion ?? ''} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                    rows={2} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Precio</label>
                    <input type="number" step="0.01" min="0" value={form.precio ?? ''}
                      onChange={e => setForm(p => ({ ...p, precio: parseFloat(e.target.value) }))}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00" />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={form.igv_incluido ?? true}
                        onChange={e => setForm(p => ({ ...p, igv_incluido: e.target.checked }))}
                        className="w-4 h-4 accent-blue-600" />
                      IGV incluido en precio
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 text-white text-sm font-semibold py-2.5 rounded-xl transition-all"
                  style={{ background: saving ? '#7eb8fa' : 'linear-gradient(135deg,#0c1d6e,#1a56db)' }}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button onClick={() => { setShowForm(false); setForm({ igv_incluido: true, unidad: 'NIU', activo: true }); setEditingId(null) }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-xl transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
