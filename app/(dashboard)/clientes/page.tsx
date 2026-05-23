'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Cliente } from '@/types/database'

export default function ClientesPage() {
  const supabase = createClient()
  const [clientes, setClientes]       = useState<Cliente[]>([])
  const [search, setSearch]           = useState('')
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [form, setForm]               = useState<Partial<Cliente>>({ tipo_documento: '6' })
  const [saving, setSaving]           = useState(false)
  const [sunatLoading, setSunatLoading] = useState(false)
  const [error, setError]             = useState('')

  const getEmpresaId = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase.from('empresa_usuarios').select('empresa_id').eq('user_id', user.id).single()
    return data?.empresa_id ?? null
  }, [supabase])

  const fetchClientes = useCallback(async () => {
    setLoading(true)
    const empresaId = await getEmpresaId()
    if (!empresaId) return
    let q = supabase.from('clientes').select('*').eq('empresa_id', empresaId).order('nombre')
    if (search) q = q.ilike('nombre', `%${search}%`)
    const { data } = await q
    setClientes(data ?? [])
    setLoading(false)
  }, [supabase, search, getEmpresaId])

  useEffect(() => { fetchClientes() }, [fetchClientes])

  async function buscarSUNAT() {
    const doc = form.ruc_dni?.trim()
    if (!doc) return
    setSunatLoading(true)
    try {
      const res = await fetch(`/api/sunat?numero=${doc}`)
      if (res.ok) {
        const data = await res.json()
        setForm(prev => ({
          ...prev,
          nombre:         data.razonSocial ?? data.nombre ?? prev.nombre,
          direccion:      data.direccion ?? prev.direccion,
          tipo_documento: doc.length === 11 ? '6' : '1',
        }))
      }
    } catch {}
    setSunatLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    const empresaId = await getEmpresaId()
    if (!empresaId) return
    const payload = { ...form, empresa_id: empresaId }
    if (editingId) {
      const { error } = await supabase.from('clientes').update(payload).eq('id', editingId)
      if (error) { setError(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('clientes').insert(payload)
      if (error) { setError(error.message); setSaving(false); return }
    }
    setShowForm(false); setForm({ tipo_documento: '6' }); setEditingId(null)
    fetchClientes(); setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este cliente?')) return
    await supabase.from('clientes').delete().eq('id', id)
    fetchClientes()
  }

  function openEdit(c: Cliente) { setForm(c); setEditingId(c.id); setShowForm(true) }
  function openNew() { setForm({ tipo_documento: '6' }); setEditingId(null); setShowForm(true) }

  return (
    <div className="p-6 md:p-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 text-sm mt-1">Gestiona tu cartera de clientes</p>
        </div>
        <button onClick={openNew}
          className="text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm"
          style={{ background: 'linear-gradient(135deg,#0c1d6e,#1a56db)' }}>
          + Nuevo cliente
        </button>
      </div>

      {/* Buscador */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 shadow-sm">
        <input
          type="text"
          placeholder="Buscar por nombre o RUC/DNI..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: 'linear-gradient(90deg,#0c1d6e,#1538d0)' }}>
              <tr>
                <th className="text-center px-4 py-3 font-medium text-white text-xs w-10">#</th>
                <th className="text-left px-4 py-3 font-medium text-white text-xs">RUC / DNI</th>
                <th className="text-left px-4 py-3 font-medium text-white text-xs">Nombre / Razón Social</th>
                <th className="text-left px-4 py-3 font-medium text-white text-xs">Correo</th>
                <th className="text-left px-4 py-3 font-medium text-white text-xs">Tipo</th>
                <th className="px-4 py-3 text-white text-xs"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">Cargando...</td></tr>
              ) : clientes.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No hay clientes registrados</td></tr>
              ) : clientes.map((c, idx) => (
                <tr key={c.id} className={`hover:bg-blue-50 transition-colors ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                  <td className="px-4 py-3.5 text-center text-xs text-gray-400 font-mono">{idx + 1}</td>
                  <td className="px-4 py-3.5 font-mono text-gray-700">{c.ruc_dni}</td>
                  <td className="px-4 py-3.5 font-semibold text-gray-800">{c.nombre}</td>
                  <td className="px-4 py-3.5 text-gray-500">{c.email ?? '—'}</td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${c.tipo_documento === '6' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {c.tipo_documento === '6' ? 'RUC' : 'DNI'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right space-x-3">
                    <button onClick={() => openEdit(c)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Editar</button>
                    <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Eliminar</button>
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
            {/* Modal header */}
            <div className="px-6 py-4" style={{ background: 'linear-gradient(135deg,#0c1d6e,#1538d0)' }}>
              <h2 className="font-bold text-white text-lg">{editingId ? 'Editar cliente' : 'Nuevo cliente'}</h2>
            </div>
            <div className="p-6">
              {error && <p className="text-red-500 text-sm mb-4 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Tipo documento</label>
                    <select value={form.tipo_documento}
                      onChange={e => setForm(p => ({ ...p, tipo_documento: e.target.value as '6' | '1' }))}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="6">RUC (Empresa)</option>
                      <option value="1">DNI (Persona)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">{form.tipo_documento === '6' ? 'RUC' : 'DNI'}</label>
                    <div className="flex gap-2 mt-1">
                      <input value={form.ruc_dni ?? ''} onChange={e => setForm(p => ({ ...p, ruc_dni: e.target.value }))}
                        maxLength={form.tipo_documento === '6' ? 11 : 8}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={form.tipo_documento === '6' ? '20600000000' : '12345678'} />
                      <button type="button" onClick={buscarSUNAT} disabled={sunatLoading}
                        className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-medium rounded-lg transition-colors">
                        {sunatLoading ? '...' : 'Buscar'}
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Nombre / Razón Social</label>
                  <input value={form.nombre ?? ''} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Dirección</label>
                  <input value={form.direccion ?? ''} onChange={e => setForm(p => ({ ...p, direccion: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Correo</label>
                    <input type="email" value={form.email ?? ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Teléfono</label>
                    <input value={form.telefono ?? ''} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 text-white text-sm font-semibold py-2.5 rounded-xl transition-all"
                  style={{ background: saving ? '#7eb8fa' : 'linear-gradient(135deg,#0c1d6e,#1a56db)' }}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button onClick={() => { setShowForm(false); setForm({ tipo_documento: '6' }); setEditingId(null) }}
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
