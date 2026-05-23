import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

async function getMetrics(empresaId: string) {
  const supabase = await createClient()
  const now      = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  const today    = now.toISOString().split('T')[0]

  const [
    { data: comprobantes },
    { data: pendientes },
    { data: recent },
    { count: totalClientes },
    { count: totalProductos },
    { data: ventasDiarias },
  ] = await Promise.all([
    supabase.from('comprobantes').select('total, estado, tipo, fecha')
      .eq('empresa_id', empresaId).gte('fecha', firstDay).lte('fecha', lastDay),
    supabase.from('comprobantes').select('id').eq('empresa_id', empresaId).eq('estado', 'borrador'),
    supabase.from('comprobantes')
      .select('id, tipo, serie, numero, total, estado, fecha, clientes(nombre)')
      .eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(6),
    supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId),
    supabase.from('productos').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('activo', true),
    supabase.from('comprobantes').select('fecha, total')
      .eq('empresa_id', empresaId).gte('fecha', firstDay).lte('fecha', lastDay)
      .in('estado', ['aceptado', 'enviado']),
  ])

  const totalFacturado  = comprobantes?.reduce((s, c) => s + Number(c.total), 0) ?? 0
  const ventasHoy       = comprobantes?.filter(c => c.fecha === today).reduce((s, c) => s + Number(c.total), 0) ?? 0
  const totalComp       = comprobantes?.length ?? 0
  const aceptados       = comprobantes?.filter(c => c.estado === 'aceptado').length ?? 0

  // Agrupar ventas por día para el gráfico (últimos 7 días del mes)
  const diasMap: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    diasMap[d.toISOString().split('T')[0]] = 0
  }
  ventasDiarias?.forEach(v => {
    if (diasMap[v.fecha] !== undefined) diasMap[v.fecha] += Number(v.total)
  })

  return {
    totalFacturado, ventasHoy, totalComp, aceptados,
    pendientes:     pendientes?.length ?? 0,
    clientes:       totalClientes ?? 0,
    productos:      totalProductos ?? 0,
    recent:         recent ?? [],
    chartData:      Object.entries(diasMap).map(([fecha, total]) => ({
      label: new Date(fecha + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' }),
      total,
    })),
  }
}

async function getEmpresaId(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('empresa_usuarios')
    .select('empresa_id, empresas(razon_social)')
    .eq('user_id', userId)
    .single()
  return data
}

const estadoColors: Record<string, string> = {
  aceptado: 'bg-green-100 text-green-700',
  rechazado: 'bg-red-100 text-red-600',
  enviado:   'bg-blue-100 text-blue-700',
  borrador:  'bg-gray-100 text-gray-600',
  anulado:   'bg-orange-100 text-orange-600',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const empresaData = await getEmpresaId(user.id)
  if (!empresaData) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Tu usuario no está vinculado a ninguna empresa.</p>
      </div>
    )
  }

  const metrics = await getMetrics(empresaData.empresa_id)

  return (
    <div className="p-4 md:p-8">

      {/* ── MOBILE ── */}
      <div className="md:hidden space-y-4">

        {/* Nuevo comprobante */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h2 className="font-bold text-gray-900 text-lg mb-4">Nuevo comprobante</h2>
          <div className="space-y-3">
            <Link href="/emitir?tipo=01"
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-blue-100 active:bg-blue-100 transition-all">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#0c1d6e,#1a56db)' }}>🧾</div>
              <div>
                <p className="font-bold text-gray-800">Factura</p>
                <p className="text-sm text-gray-400">Requiere RUC del cliente</p>
              </div>
            </Link>
            <Link href="/emitir?tipo=03"
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-blue-100 active:bg-blue-100 transition-all">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#1538d0,#40a0fb)' }}>📋</div>
              <div>
                <p className="font-bold text-gray-800">Boleta</p>
                <p className="text-sm text-gray-400">DNI o sin documento</p>
              </div>
            </Link>
          </div>

          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-3">Accesos rápidos</p>
            <div className="space-y-1">
              {[
                { href: '/clientes',     label: 'Clientes',  icon: '👥' },
                { href: '/productos',    label: 'Productos', icon: '📦' },
                { href: '/comprobantes', label: 'Historial', icon: '📄' },
              ].map(item => (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 active:bg-gray-100 transition-colors">
                  <span className="text-base">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Comprobantes recientes (móvil) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Comprobantes recientes</h2>
            <Link href="/comprobantes" className="text-xs font-medium text-blue-600">Ver todos →</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {metrics.recent.length === 0 ? (
              <p className="text-center py-8 text-gray-400 text-sm">No hay comprobantes aún</p>
            ) : (
              metrics.recent.map((c: Record<string, unknown>) => {
                const cliente = c.clientes as Record<string, string> | null
                return (
                  <Link key={c.id as string} href={`/comprobantes/${c.id}`}
                    className="flex items-center justify-between px-5 py-3.5 active:bg-gray-50">
                    <div>
                      <p className="font-mono text-sm font-semibold text-blue-700">
                        {c.serie}-{String(c.numero).padStart(8, '0')}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[180px]">
                        {cliente?.nombre ?? 'Cliente Varios'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm text-gray-800">S/ {Number(c.total).toFixed(2)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${estadoColors[c.estado as string] ?? 'bg-gray-100 text-gray-600'}`}>
                        {c.estado as string}
                      </span>
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>

      </div>

      {/* ── DESKTOP: dashboard completo ── */}
      <div className="hidden md:block">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Resumen</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard label="Ventas del día" value={`S/ ${metrics.ventasHoy.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`} icon="💰" accent="#1a56db" />
          <StatCard label="Comprobantes"   value={String(metrics.totalComp)}   icon="📄" accent="#0c1d6e" sub="este mes" />
          <StatCard label="Clientes"       value={String(metrics.clientes)}    icon="👥" accent="#1538d0" />
          <StatCard label="Productos"      value={String(metrics.productos)}   icon="📦" accent="#40a0fb" />
        </div>

        {/* Chart — ancho completo */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Ventas</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Últimos 7 días</span>
          </div>
          <MiniChart data={metrics.chartData} />
        </div>

        {/* Recent comprobantes table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Comprobantes recientes</h2>
            <Link href="/comprobantes" className="text-xs font-medium text-blue-600 hover:text-blue-800">Ver todos →</Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-medium">Serie - Número</th>
                <th className="text-left px-5 py-3 font-medium">Cliente</th>
                <th className="text-left px-5 py-3 font-medium">Tipo</th>
                <th className="text-left px-5 py-3 font-medium">Fecha</th>
                <th className="text-right px-5 py-3 font-medium">Total</th>
                <th className="text-left px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {metrics.recent.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">No hay comprobantes aún</td></tr>
              ) : (
                metrics.recent.map((c: Record<string, unknown>) => {
                  const cliente = c.clientes as Record<string, string> | null
                  return (
                    <tr key={c.id as string} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link href={`/comprobantes/${c.id}`} className="font-mono text-blue-700 hover:underline font-medium">
                          {c.serie}-{String(c.numero).padStart(8, '0')}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">{cliente?.nombre ?? 'Cliente Varios'}</td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.tipo === '01' ? 'bg-indigo-100 text-indigo-700' : 'bg-cyan-100 text-cyan-700'}`}>
                          {c.tipo === '01' ? 'Factura' : 'Boleta'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">
                        {new Date((c.fecha as string) + 'T00:00:00').toLocaleDateString('es-PE')}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-gray-800">
                        S/ {Number(c.total).toFixed(2)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estadoColors[c.estado as string] ?? 'bg-gray-100 text-gray-600'}`}>
                          {c.estado as string}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

      </div>{/* end desktop */}
    </div>
  )
}

function StatCard({ label, value, icon, accent, sub }: {
  label: string; value: string; icon: string; accent: string; sub?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-5 -mt-4 -mr-4"
        style={{ background: accent }} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className="text-xl md:text-2xl font-bold mt-1 text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  )
}

function MiniChart({ data }: { data: { label: string; total: number }[] }) {
  const max = Math.max(...data.map(d => d.total), 1)
  const W = 500, H = 140, pad = 20, bottom = 30

  const points = data.map((d, i) => ({
    x: pad + (i / (data.length - 1)) * (W - pad * 2),
    y: H - bottom - ((d.total / max) * (H - bottom - pad)),
    ...d,
  }))

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaD = `${pathD} L${points[points.length - 1].x},${H - bottom} L${points[0].x},${H - bottom} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-36">
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#1a56db" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#1a56db" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => (
        <line key={t}
          x1={pad} y1={H - bottom - t * (H - bottom - pad)}
          x2={W - pad} y2={H - bottom - t * (H - bottom - pad)}
          stroke="#f1f5f9" strokeWidth="1"
        />
      ))}

      {/* Area fill */}
      <path d={areaD} fill="url(#chartGrad)" />

      {/* Line */}
      <path d={pathD} fill="none" stroke="#1a56db" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* Dots + labels */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#1a56db" />
          <circle cx={p.x} cy={p.y} r="2" fill="white" />
          <text x={p.x} y={H - 6} textAnchor="middle" fontSize="10" fill="#94a3b8">{p.label}</text>
          {p.total > 0 && (
            <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fill="#1a56db" fontWeight="600">
              {p.total > 0 ? `S/${p.total.toFixed(0)}` : ''}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}
