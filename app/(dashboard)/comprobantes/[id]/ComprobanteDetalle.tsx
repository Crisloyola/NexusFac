'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/client'
import type { Comprobante, ComprobanteItem, Empresa, Cliente } from '@/types/database'

const PdfDownloadButton = dynamic(() => import('@/components/PdfDownloadButton'), { ssr: false })

const TIPO_LABELS: Record<string, string> = {
  '01': 'Factura',
  '03': 'Boleta',
  '07': 'Nota de Crédito',
}

const estadoColors: Record<string, string> = {
  aceptado: 'bg-green-100 text-green-700',
  rechazado: 'bg-red-100 text-red-600',
  enviado: 'bg-blue-100 text-blue-600',
  borrador: 'bg-gray-100 text-gray-600',
  anulado: 'bg-orange-100 text-orange-600',
}

interface Props {
  comprobante: Comprobante & { clientes: Cliente | null; comprobante_items: ComprobanteItem[] }
  empresa: Empresa
}

export default function ComprobanteDetalle({ comprobante, empresa }: Props) {
  const items = comprobante.comprobante_items ?? []
  const cliente = comprobante.clientes
  const router = useRouter()
  const supabase = createClient()
  const [accionLoading, setAccionLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState<'eliminar' | 'anular' | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  const qrData = (comprobante.nubefact_response as Record<string, string> | null)?.cadena_para_codigo_qr
  const pdfUrl = (comprobante.nubefact_response as Record<string, string> | null)?.enlace_del_pdf

  useEffect(() => {
    if (!qrData) return
    QRCode.toDataURL(qrData, { width: 120, margin: 1 }).then(setQrDataUrl).catch(() => null)
  }, [qrData])

  function handleWhatsApp() {
    if (!cliente?.telefono) return
    const telefono = cliente.telefono.replace(/\D/g, '')
    const numero = telefono.length === 9 ? `51${telefono}` : telefono

    const tipoTexto = TIPO_LABELS[comprobante.tipo] ?? 'Comprobante'
    const fecha = new Date(comprobante.fecha + 'T00:00:00').toLocaleDateString('es-PE', { dateStyle: 'long' })
    const total = `S/ ${Number(comprobante.total).toFixed(2)}`

    let mensaje = `Hola ${cliente.nombre}!\n\nTe enviamos tu *${tipoTexto} Electrónica* de *${empresa.razon_social}*:\n\n`
    mensaje += `📄 Número: *${numeroCompleto}*\n`
    mensaje += `📅 Fecha: ${fecha}\n`
    mensaje += `💰 Total: *${total}*\n`
    if (pdfUrl) mensaje += `\n📥 Descarga tu comprobante:\n${pdfUrl}\n`
    mensaje += `\n_Comprobante válido ante SUNAT_`

    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`, '_blank')
  }

  async function handleEliminar() {
    setAccionLoading(true)
    await supabase.from('comprobante_items').delete().eq('comprobante_id', comprobante.id)
    await supabase.from('comprobantes').delete().eq('id', comprobante.id)
    router.push('/comprobantes')
  }

  async function handleAnular() {
    setAccionLoading(true)
    await supabase
      .from('comprobantes')
      .update({ estado: 'anulado', updated_at: new Date().toISOString() })
      .eq('id', comprobante.id)
    setAccionLoading(false)
    setShowConfirm(null)
    router.refresh()
  }

  const tipoLabel = TIPO_LABELS[comprobante.tipo] ?? 'Comprobante'
  const numeroCompleto = `${comprobante.serie}-${String(comprobante.numero).padStart(8, '0')}`

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/comprobantes" className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block">
            ← Volver a comprobantes
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {tipoLabel} {numeroCompleto}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${estadoColors[comprobante.estado]}`}>
              {comprobante.estado}
            </span>
            <span className="text-sm text-gray-500">
              {new Date(comprobante.fecha + 'T00:00:00').toLocaleDateString('es-PE', { dateStyle: 'long' })}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <PdfDownloadButton
            comprobante={comprobante}
            items={items}
            empresa={empresa}
            cliente={cliente}
            fileName={`${comprobante.serie}-${String(comprobante.numero).padStart(8, '0')}.pdf`}
          />
          {comprobante.xml_url && (
            <a
              href={comprobante.xml_url}
              target="_blank"
              rel="noreferrer"
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              XML
            </a>
          )}
          {comprobante.cdr_url && (
            <a
              href={comprobante.cdr_url}
              target="_blank"
              rel="noreferrer"
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              CDR
            </a>
          )}
          {cliente?.telefono && (
            <button
              onClick={handleWhatsApp}
              className="bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              WhatsApp
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            Imprimir
          </button>

          {/* Acciones destructivas */}
          {comprobante.estado === 'borrador' && (
            <button
              onClick={() => setShowConfirm('eliminar')}
              className="bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              Eliminar
            </button>
          )}
          {(comprobante.estado === 'aceptado' || comprobante.estado === 'enviado') && (
            <button
              onClick={() => setShowConfirm('anular')}
              className="bg-orange-50 hover:bg-orange-100 text-orange-600 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              Anular
            </button>
          )}
        </div>
      </div>

      {/* Modal confirmación */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            {showConfirm === 'eliminar' ? (
              <>
                <h3 className="font-bold text-gray-900 text-lg mb-2">¿Eliminar borrador?</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Se eliminará permanentemente <span className="font-medium text-gray-700">{numeroCompleto}</span> de la base de datos. Esta acción no se puede deshacer.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleEliminar}
                    disabled={accionLoading}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                  >
                    {accionLoading ? 'Eliminando...' : 'Sí, eliminar'}
                  </button>
                  <button
                    onClick={() => setShowConfirm(null)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-bold text-gray-900 text-lg mb-2">¿Anular comprobante?</h3>
                <p className="text-sm text-gray-500 mb-2">
                  Se marcará <span className="font-medium text-gray-700">{numeroCompleto}</span> como <span className="font-medium text-orange-600">anulado</span> en el sistema.
                </p>
                <p className="text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2 mb-6">
                  Para que la anulación sea válida ante SUNAT debes también comunicarla desde el panel de Nubefact dentro de los 7 días calendario.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleAnular}
                    disabled={accionLoading}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                  >
                    {accionLoading ? 'Anulando...' : 'Sí, anular'}
                  </button>
                  <button
                    onClick={() => setShowConfirm(null)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Vista previa del comprobante */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden print:shadow-none">
        {/* Cabecera */}
        <div className="flex justify-between items-start p-6 border-b border-gray-100">
          <div>
            {empresa.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={empresa.logo_url} alt="Logo" className="h-12 mb-3 object-contain" />
            )}
            <p className="font-bold text-gray-900">{empresa.razon_social}</p>
            <p className="text-sm text-gray-500">RUC: {empresa.ruc}</p>
            <p className="text-sm text-gray-500">{empresa.direccion}</p>
          </div>
          <div className="text-right border-2 border-blue-800 rounded-lg px-6 py-4">
            <p className="text-xs text-gray-500 uppercase font-medium">
              {comprobante.tipo === '01' ? 'Factura Electrónica' : 'Boleta de Venta Electrónica'}
            </p>
            <p className="text-xl font-bold text-blue-900 mt-1">{numeroCompleto}</p>
          </div>
        </div>

        {/* Cliente */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium mb-1">Cliente</p>
              <p className="font-semibold text-gray-800">{cliente?.nombre ?? 'CLIENTE VARIOS'}</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {cliente?.tipo_documento === '6' ? 'RUC' : 'DNI'}: {cliente?.ruc_dni ?? '—'}
              </p>
              {cliente?.direccion && <p className="text-sm text-gray-500">{cliente.direccion}</p>}
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-medium mb-1">Fecha de emisión</p>
              <p className="font-semibold text-gray-800">
                {new Date(comprobante.fecha + 'T00:00:00').toLocaleDateString('es-PE', { dateStyle: 'long' })}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">Moneda: SOLES (PEN)</p>
            </div>
          </div>
        </div>

        {/* Ítems */}
        <table className="w-full text-sm">
          <thead className="bg-blue-900 text-white">
            <tr>
              <th className="text-left px-6 py-2.5 font-medium text-xs">Cant.</th>
              <th className="text-left px-6 py-2.5 font-medium text-xs">Unid.</th>
              <th className="text-left px-6 py-2.5 font-medium text-xs">Descripción</th>
              <th className="text-right px-6 py-2.5 font-medium text-xs">P. Unit</th>
              <th className="text-right px-6 py-2.5 font-medium text-xs">Subtotal</th>
              <th className="text-right px-6 py-2.5 font-medium text-xs">IGV</th>
              <th className="text-right px-6 py-2.5 font-medium text-xs">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item, idx) => (
              <tr key={item.id} className={idx % 2 === 0 ? '' : 'bg-gray-50'}>
                <td className="px-6 py-3 text-gray-700">{Number(item.cantidad).toFixed(2)}</td>
                <td className="px-6 py-3 text-gray-500">{item.unidad}</td>
                <td className="px-6 py-3 text-gray-800">{item.descripcion}</td>
                <td className="px-6 py-3 text-right text-gray-700">S/ {Number(item.precio_con_igv).toFixed(2)}</td>
                <td className="px-6 py-3 text-right text-gray-700">S/ {Number(item.subtotal).toFixed(2)}</td>
                <td className="px-6 py-3 text-right text-gray-700">S/ {Number(item.igv).toFixed(2)}</td>
                <td className="px-6 py-3 text-right font-medium text-gray-900">S/ {Number(item.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totales */}
        <div className="flex justify-end px-6 py-4 border-t border-gray-100">
          <div className="w-64 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Op. Gravadas:</span>
              <span>S/ {Number(comprobante.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>IGV (18%):</span>
              <span>S/ {Number(comprobante.igv).toFixed(2)}</span>
            </div>
            <div className="h-px bg-gray-200 my-2" />
            <div className="flex justify-between font-bold text-blue-900 text-base">
              <span>TOTAL:</span>
              <span>S/ {Number(comprobante.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Importe en letras */}
        <div className="px-6 pb-4">
          <div className="bg-blue-50 rounded-lg px-4 py-2 text-sm text-blue-700">
            <span className="font-semibold">SON: </span>
            {/* Importar dinámicamente para evitar SSR issues */}
            Son {Number(comprobante.total).toFixed(2)} soles
          </div>
        </div>

        {/* Footer CDR / QR / observaciones */}
        {(comprobante.hash_cdr || comprobante.observaciones || qrDataUrl) && (
          <div className="px-6 pb-6 pt-4 border-t border-gray-100 flex items-start justify-between gap-6">
            <div className="text-xs text-gray-400 space-y-1 flex-1">
              {comprobante.hash_cdr && (
                <p>Hash CDR: <span className="font-mono break-all">{comprobante.hash_cdr}</span></p>
              )}
              {comprobante.observaciones && <p>Obs: {comprobante.observaciones}</p>}
              <p className="text-gray-300 pt-2">Representación impresa del comprobante electrónico — NexusFac</p>
            </div>
            {qrDataUrl && (
              <div className="flex flex-col items-center shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="Código QR SUNAT" className="w-24 h-24 border border-gray-100 rounded" />
                <p className="text-xs text-gray-400 mt-1">QR SUNAT</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
