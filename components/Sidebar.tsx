'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/dashboard',     label: 'Inicio',            icon: '🏠' },
  { href: '/emitir',        label: 'Nuevo comprobante', icon: '✏️' },
  { href: '/comprobantes',  label: 'Comprobantes',      icon: '📄' },
  { href: '/reportes',      label: 'Reportes',          icon: '📊' },
  { href: '/clientes',      label: 'Clientes',          icon: '👥' },
  { href: '/productos',     label: 'Productos',         icon: '📦' },
  { href: '/configuracion', label: 'Configuración',     icon: '⚙️' },
]

interface SidebarProps {
  onClose?: () => void
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside
      className="w-64 min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(180deg, #0c1d6e 0%, #0e2280 60%, #112096 100%)' }}
    >
      {/* Logo + close button */}
      <div className="px-4 pt-5 pb-4 flex items-start justify-between">
        <div className="bg-white rounded-2xl p-3 shadow-lg flex-1">
          <Image
            src="/logoNexus.png"
            alt="NexusFac"
            width={200}
            height={200}
            className="w-full h-auto object-contain"
            priority
          />
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden ml-2 mt-1 text-white/60 hover:text-white p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="mx-4 mb-3" style={{ height: '1px', background: 'rgba(255,255,255,0.1)' }} />

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map(item => {
          const active = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
              style={active
                ? { background: 'rgba(255,255,255,0.15)', color: '#ffffff' }
                : { color: 'rgba(255,255,255,0.65)' }
              }
            >
              <span
                className="w-1 h-5 rounded-full flex-shrink-0"
                style={{ background: active ? '#40a0fb' : 'transparent' }}
              />
              <span className="text-base leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-4 py-4">
        <div className="mb-3" style={{ height: '1px', background: 'rgba(255,255,255,0.1)' }} />
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          <span>🚪</span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}
