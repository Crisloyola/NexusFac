'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Empresa } from '@/types/database'

export default function ConfiguracionPage() {
  const supabase = createClient()
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [form, setForm] = useState<Partial<Empresa>>({})
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  const getEmpresa = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: eu } = await supabase
      .from('empresa_usuarios')
      .select('empresa_id')
      .eq('user_id', user.id)
      .single()
    if (!eu) return
    const { data } = await supabase.from('empresas').select('*').eq('id', eu.empresa_id).single()
    if (data) { setEmpresa(data); setForm(data) }
  }, [supabase])

  useEffect(() => { getEmpresa() }, [getEmpresa])

  async function handleSave() {
    if (!empresa) return
    setSaving(true)
    setError('')
    setSuccess(false)
    const { error } = await supabase
      .from('empresas')
      .update({
        razon_social: form.razon_social,
        nombre_comercial: form.nombre_comercial,
        direccion: form.direccion,
        ubigeo: form.ubigeo,
        nubefact_token: form.nubefact_token,
        serie_factura: form.serie_factura,
        serie_boleta: form.serie_boleta,
        updated_at: new Date().toISOString(),
      })
      .eq('id', empresa.id)
    if (error) setError(error.message)
    else { setSuccess(true); getEmpresa() }
    setSaving(false)
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !empresa) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `logos/${empresa.id}.${ext}`
    const { error: upErr } = await supabase.storage.from('comprobantes').upload(path, file, { upsert: true })
    if (upErr) { setError(upErr.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('comprobantes').getPublicUrl(path)
    await supabase.from('empresas').update({ logo_url: urlData.publicUrl }).eq('id', empresa.id)
    setForm(p => ({ ...p, logo_url: urlData.publicUrl }))
    setUploading(false)
  }

  if (!empresa) return <div className="p-8 text-gray-400">Cargando configuración...</div>

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500 text-sm mt-1">Datos de tu empresa y configuración de facturación</p>
      </div>

      {success && <div className="mb-4 bg-green-100 text-green-700 text-sm px-4 py-3 rounded-lg">Configuración guardada correctamente</div>}
      {error   && <div className="mb-4 bg-red-100 text-red-600 text-sm px-4 py-3 rounded-lg">{error}</div>}

      {/* Grid 2 columnas en desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

        {/* Columna izquierda — Datos de empresa */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Datos de la empresa</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600">RUC</label>
                <input
                  value={form.ruc ?? ''}
                  disabled
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-400 mt-1">No modificable</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Nombre Comercial</label>
                <input
                  value={form.nombre_comercial ?? ''}
                  onChange={e => setForm(p => ({ ...p, nombre_comercial: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Razón Social</label>
              <input
                value={form.razon_social ?? ''}
                onChange={e => setForm(p => ({ ...p, razon_social: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Dirección</label>
              <input
                value={form.direccion ?? ''}
                onChange={e => setForm(p => ({ ...p, direccion: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Ubigeo (6 dígitos)</label>
              <input
                value={form.ubigeo ?? ''}
                onChange={e => setForm(p => ({ ...p, ubigeo: e.target.value }))}
                maxLength={6}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="150101"
              />
            </div>

            {/* Logo dentro de datos de empresa */}
            <div className="pt-2 border-t border-gray-100">
              <label className="text-xs font-medium text-gray-600 block mb-2">Logo de la empresa</label>
              <div className="flex items-center gap-4">
                {form.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.logo_url} alt="Logo" className="w-16 h-16 object-contain border border-gray-200 rounded-lg p-1" />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">Sin logo</div>
                )}
                <div>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploading} className="text-xs text-gray-600" />
                  {uploading && <p className="text-xs text-blue-500 mt-1">Subiendo...</p>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Columna derecha — Nubefact + Series */}
        <div className="space-y-5">

          {/* Nubefact */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-800 mb-1">Integración Nubefact</h2>
            <p className="text-xs text-gray-400 mb-4">Obtén tu token en nubefact.com</p>
            <div>
              <label className="text-xs font-medium text-gray-600">Token API Nubefact</label>
              <input
                type="password"
                value={form.nubefact_token ?? ''}
                onChange={e => setForm(p => ({ ...p, nubefact_token: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••••••••••••••••••••••"
              />
            </div>
          </div>

          {/* Series */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-800 mb-1">Series de comprobantes</h2>
            <p className="text-xs text-gray-400 mb-4">Deben coincidir con las registradas en Nubefact</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600">Serie Factura</label>
                <input
                  value={form.serie_factura ?? ''}
                  onChange={e => setForm(p => ({ ...p, serie_factura: e.target.value.toUpperCase() }))}
                  maxLength={4}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="F001"
                />
                <p className="text-xs text-gray-400 mt-1">Correlativo: <span className="font-mono font-medium">{empresa.correlativo_factura}</span></p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Serie Boleta</label>
                <input
                  value={form.serie_boleta ?? ''}
                  onChange={e => setForm(p => ({ ...p, serie_boleta: e.target.value.toUpperCase() }))}
                  maxLength={4}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="B001"
                />
                <p className="text-xs text-gray-400 mt-1">Correlativo: <span className="font-mono font-medium">{empresa.correlativo_boleta}</span></p>
              </div>
            </div>
          </div>

        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full text-white font-semibold py-3 rounded-xl text-sm transition-all"
        style={{ background: saving ? '#7eb8fa' : 'linear-gradient(135deg,#0c1d6e,#1a56db)' }}
      >
        {saving ? 'Guardando...' : 'Guardar configuración'}
      </button>
    </div>
  )
}
