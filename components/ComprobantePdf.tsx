'use client'

import {
  Document, Page, Text, View, StyleSheet, Image, Font,
} from '@react-pdf/renderer'
import { numeroALetras } from '@/lib/numero-a-letras'
import type { Comprobante, ComprobanteItem, Empresa, Cliente } from '@/types/database'

Font.register({
  family: 'Helvetica',
  fonts: [{ src: 'Helvetica' }, { src: 'Helvetica-Bold', fontWeight: 'bold' }],
})

const TIPO_LABELS: Record<string, string> = {
  '01': 'FACTURA ELECTRÓNICA',
  '03': 'BOLETA DE VENTA ELECTRÓNICA',
  '07': 'NOTA DE CRÉDITO ELECTRÓNICA',
}

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 8, padding: 30, color: '#1a1a1a' },
  row: { flexDirection: 'row' },
  col: { flexDirection: 'column' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  logo: { width: 80, height: 40, objectFit: 'contain' },
  box: { border: '1.5pt solid #1e3a5f', borderRadius: 4, padding: '6 8', minWidth: 160, alignItems: 'center' },
  boxTitle: { fontSize: 10, fontWeight: 'bold', color: '#1e3a5f', textAlign: 'center' },
  boxSub: { fontSize: 8, color: '#444', textAlign: 'center', marginTop: 2 },
  sectionTitle: { fontSize: 7, color: '#666', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 },
  infoBlock: { backgroundColor: '#f3f4f6', borderRadius: 3, padding: '5 8', marginBottom: 8, flex: 1 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#1e3a5f', color: 'white', padding: '4 6' },
  tableRow: { flexDirection: 'row', borderBottom: '0.5pt solid #e5e7eb', padding: '3 6' },
  tableRowAlt: { flexDirection: 'row', backgroundColor: '#f9fafb', borderBottom: '0.5pt solid #e5e7eb', padding: '3 6' },
  th: { fontSize: 7, fontWeight: 'bold', color: 'white' },
  td: { fontSize: 7.5, color: '#333' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', padding: '2 6' },
  totalLabel: { width: 80, textAlign: 'right', fontSize: 7.5, color: '#555' },
  totalValue: { width: 60, textAlign: 'right', fontSize: 7.5 },
  totalFinal: { width: 80, textAlign: 'right', fontSize: 9, fontWeight: 'bold', color: '#1e3a5f' },
  totalFinalValue: { width: 60, textAlign: 'right', fontSize: 9, fontWeight: 'bold', color: '#1e3a5f' },
  letras: { backgroundColor: '#eff6ff', borderRadius: 3, padding: '4 8', marginTop: 4, marginBottom: 8 },
  footer: { marginTop: 10, borderTop: '0.5pt solid #e5e7eb', paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
})

interface Props {
  comprobante: Comprobante
  items: ComprobanteItem[]
  empresa: Empresa
  cliente: Cliente | null
  logoBase64?: string
  qrBase64?: string
}

export default function ComprobantePdf({ comprobante, items, empresa, cliente, logoBase64, qrBase64 }: Props) {
  const tipoLabel = TIPO_LABELS[comprobante.tipo] ?? 'COMPROBANTE ELECTRÓNICO'
  const numeroCompleto = `${comprobante.serie}-${String(comprobante.numero).padStart(8, '0')}`
  const fechaFormato = new Date(comprobante.fecha + 'T00:00:00').toLocaleDateString('es-PE', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  const logoSrc = logoBase64 ?? empresa.logo_url

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* HEADER */}
        <View style={s.header}>
          <View style={[s.col, { flex: 1, paddingRight: 16 }]}>
            {logoSrc && <Image src={logoSrc} style={s.logo} />}
            <Text style={{ fontSize: 9, fontWeight: 'bold', marginTop: 4 }}>{empresa.razon_social}</Text>
            <Text style={{ fontSize: 7, color: '#555', marginTop: 2 }}>RUC: {empresa.ruc}</Text>
            <Text style={{ fontSize: 7, color: '#555', marginTop: 1 }}>{empresa.direccion}</Text>
          </View>
          <View style={s.box}>
            <Text style={s.boxTitle}>{empresa.razon_social}</Text>
            <Text style={{ fontSize: 7, color: '#888', marginTop: 2 }}>{tipoLabel}</Text>
            <View style={{ border: '0.5pt solid #1e3a5f', marginVertical: 4, width: '100%' }} />
            <Text style={[s.boxTitle, { fontSize: 11 }]}>{numeroCompleto}</Text>
          </View>
        </View>

        {/* CLIENTE + FECHA */}
        <View style={[s.row, { gap: 8, marginBottom: 8 }]}>
          <View style={s.infoBlock}>
            <Text style={s.sectionTitle}>Datos del cliente</Text>
            <Text style={{ fontSize: 8, fontWeight: 'bold' }}>{cliente?.nombre ?? 'CLIENTE VARIOS'}</Text>
            <Text style={{ fontSize: 7, color: '#555', marginTop: 1 }}>
              {cliente?.tipo_documento === '6' ? 'RUC' : 'DNI'}: {cliente?.ruc_dni ?? '—'}
            </Text>
            {cliente?.direccion && <Text style={{ fontSize: 7, color: '#555', marginTop: 1 }}>{cliente.direccion}</Text>}
            {cliente?.email && <Text style={{ fontSize: 7, color: '#555', marginTop: 1 }}>{cliente.email}</Text>}
          </View>
          <View style={[s.infoBlock, { maxWidth: 160 }]}>
            <Text style={s.sectionTitle}>Comprobante</Text>
            <Text style={{ fontSize: 7, color: '#555', marginTop: 1 }}>Fecha emisión:</Text>
            <Text style={{ fontSize: 8, fontWeight: 'bold' }}>{fechaFormato}</Text>
            <Text style={{ fontSize: 7, color: '#555', marginTop: 4 }}>Moneda: SOLES (PEN)</Text>
            <Text style={{ fontSize: 7, color: '#555', marginTop: 1 }}>
              Estado: <Text style={{ color: comprobante.estado === 'aceptado' ? '#16a34a' : '#dc2626' }}>
                {comprobante.estado.toUpperCase()}
              </Text>
            </Text>
          </View>
        </View>

        {/* TABLA DE ÍTEMS */}
        <View style={{ marginBottom: 8 }}>
          <View style={s.tableHeader}>
            <Text style={[s.th, { width: 30 }]}>Cant.</Text>
            <Text style={[s.th, { width: 35 }]}>Unidad</Text>
            <Text style={[s.th, { flex: 1 }]}>Descripción</Text>
            <Text style={[s.th, { width: 55, textAlign: 'right' }]}>P. Unit</Text>
            <Text style={[s.th, { width: 55, textAlign: 'right' }]}>Subtotal</Text>
            <Text style={[s.th, { width: 45, textAlign: 'right' }]}>IGV</Text>
            <Text style={[s.th, { width: 55, textAlign: 'right' }]}>Total</Text>
          </View>
          {items.map((item, idx) => (
            <View key={item.id} style={idx % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={[s.td, { width: 30 }]}>{Number(item.cantidad).toFixed(2)}</Text>
              <Text style={[s.td, { width: 35 }]}>{item.unidad}</Text>
              <Text style={[s.td, { flex: 1 }]}>{item.descripcion}</Text>
              <Text style={[s.td, { width: 55, textAlign: 'right' }]}>
                S/ {Number(item.precio_con_igv).toFixed(2)}
              </Text>
              <Text style={[s.td, { width: 55, textAlign: 'right' }]}>S/ {Number(item.subtotal).toFixed(2)}</Text>
              <Text style={[s.td, { width: 45, textAlign: 'right' }]}>S/ {Number(item.igv).toFixed(2)}</Text>
              <Text style={[s.td, { width: 55, textAlign: 'right' }]}>S/ {Number(item.total).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* TOTALES */}
        <View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Op. Gravadas:</Text>
            <Text style={s.totalValue}>S/ {Number(comprobante.subtotal).toFixed(2)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>IGV (18%):</Text>
            <Text style={s.totalValue}>S/ {Number(comprobante.igv).toFixed(2)}</Text>
          </View>
          <View style={[s.totalRow, { borderTop: '1pt solid #1e3a5f', marginTop: 2, paddingTop: 3 }]}>
            <Text style={s.totalFinal}>TOTAL:</Text>
            <Text style={s.totalFinalValue}>S/ {Number(comprobante.total).toFixed(2)}</Text>
          </View>
        </View>

        {/* IMPORTE EN LETRAS */}
        <View style={s.letras}>
          <Text style={{ fontSize: 7, color: '#555', fontWeight: 'bold' }}>SON: </Text>
          <Text style={{ fontSize: 7.5, color: '#1e3a5f' }}>{numeroALetras(Number(comprobante.total))}</Text>
        </View>

        {/* FOOTER */}
        <View style={s.footer}>
          <View style={{ flex: 1 }}>
            {comprobante.hash_cdr && (
              <>
                <Text style={{ fontSize: 6, color: '#888' }}>Hash CDR:</Text>
                <Text style={{ fontSize: 6, color: '#555', fontFamily: 'Helvetica', maxWidth: 300 }}>
                  {comprobante.hash_cdr}
                </Text>
              </>
            )}
            {comprobante.observaciones && (
              <Text style={{ fontSize: 7, color: '#555', marginTop: 4 }}>
                Obs: {comprobante.observaciones}
              </Text>
            )}
            <Text style={{ fontSize: 6, color: '#aaa', marginTop: 4 }}>Comprobante electrónico emitido vía</Text>
            <Text style={{ fontSize: 7, color: '#1e3a5f', fontWeight: 'bold' }}>NexusFac</Text>
            <Text style={{ fontSize: 6, color: '#aaa', marginTop: 1 }}>Representación impresa del comprobante electrónico</Text>
          </View>
          {qrBase64 && (
            <View style={{ alignItems: 'center', marginLeft: 12 }}>
              <Image src={qrBase64} style={{ width: 64, height: 64 }} />
              <Text style={{ fontSize: 5, color: '#aaa', marginTop: 2 }}>Código QR SUNAT</Text>
            </View>
          )}
        </View>
      </Page>
    </Document>
  )
}
