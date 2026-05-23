'use client'

import { useState, useEffect } from 'react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import ComprobantePdf from './ComprobantePdf'
import type { Comprobante, ComprobanteItem, Empresa, Cliente } from '@/types/database'

interface Props {
  comprobante: Comprobante
  items: ComprobanteItem[]
  empresa: Empresa
  cliente: Cliente | null
  fileName: string
}

async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export default function PdfDownloadButton({ comprobante, items, empresa, cliente, fileName }: Props) {
  const [logoBase64, setLogoBase64] = useState<string | undefined>()
  const [qrBase64, setQrBase64] = useState<string | undefined>()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function prepare() {
      const qrData = (comprobante.nubefact_response as Record<string, string> | null)?.cadena_para_codigo_qr

      const [logo, qr] = await Promise.all([
        empresa.logo_url
          ? urlToBase64(empresa.logo_url).catch(() => undefined)
          : Promise.resolve(undefined),
        qrData
          ? QRCode.toDataURL(qrData, { width: 80, margin: 1 }).catch(() => undefined)
          : Promise.resolve(undefined),
      ])

      setLogoBase64(logo)
      setQrBase64(qr)
      setReady(true)
    }
    prepare()
  }, [comprobante, empresa])

  if (!ready) {
    return (
      <button
        disabled
        className="bg-blue-400 text-white text-sm font-medium px-4 py-2.5 rounded-lg cursor-not-allowed opacity-70"
      >
        Preparando...
      </button>
    )
  }

  return (
    <PDFDownloadLink
      document={
        <ComprobantePdf
          comprobante={comprobante}
          items={items}
          empresa={empresa}
          cliente={cliente}
          logoBase64={logoBase64}
          qrBase64={qrBase64}
        />
      }
      fileName={fileName}
      className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
    >
      {({ loading }) => loading ? 'Generando...' : '⬇ Descargar PDF'}
    </PDFDownloadLink>
  )
}
