'use client'

import { PDFDownloadLink } from '@react-pdf/renderer'
import ComprobantePdf from './ComprobantePdf'
import type { Comprobante, ComprobanteItem, Empresa, Cliente } from '@/types/database'

interface Props {
  comprobante: Comprobante
  items: ComprobanteItem[]
  empresa: Empresa
  cliente: Cliente | null
  fileName: string
}

export default function PdfDownloadButton({ comprobante, items, empresa, cliente, fileName }: Props) {
  return (
    <PDFDownloadLink
      document={
        <ComprobantePdf
          comprobante={comprobante}
          items={items}
          empresa={empresa}
          cliente={cliente}
        />
      }
      fileName={fileName}
      className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
    >
      {({ loading }) => loading ? 'Generando...' : '⬇ Descargar PDF'}
    </PDFDownloadLink>
  )
}
