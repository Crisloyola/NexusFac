const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE']
const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE']
const centenas = ['', 'CIEN', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

function cientos(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'CIEN'
  const c = Math.floor(n / 100)
  const resto = n % 100
  const prefijo = c > 0 ? centenas[c] + (resto > 0 ? ' ' : '') : ''
  if (resto === 0) return prefijo
  if (resto < 10) return prefijo + unidades[resto]
  if (resto < 20) return prefijo + especiales[resto - 10]
  const d = Math.floor(resto / 10)
  const u = resto % 10
  return prefijo + decenas[d] + (u > 0 ? ' Y ' + unidades[u] : '')
}

function miles(n: number): string {
  const m = Math.floor(n / 1000)
  const resto = n % 1000
  if (m === 0) return cientos(resto)
  const prefM = m === 1 ? 'MIL' : cientos(m) + ' MIL'
  return prefM + (resto > 0 ? ' ' + cientos(resto) : '')
}

function millones(n: number): string {
  const m = Math.floor(n / 1000000)
  const resto = n % 1000000
  if (m === 0) return miles(resto)
  const prefM = m === 1 ? 'UN MILLÓN' : cientos(m) + ' MILLONES'
  return prefM + (resto > 0 ? ' ' + miles(resto) : '')
}

export function numeroALetras(monto: number): string {
  const entero = Math.floor(monto)
  const cents = Math.round((monto - entero) * 100)
  const letras = entero === 0 ? 'CERO' : millones(entero)
  return `${letras} Y ${String(cents).padStart(2, '0')}/100 SOLES`
}
