'use client'

import { useState } from 'react'
import Image from 'next/image'
import Sidebar from '@/components/Sidebar'

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen" style={{ background: '#f0f4ff' }}>

      {/* ── Desktop sidebar: always visible, normal flow ── */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="w-64">
          <Sidebar />
        </div>
      </div>

      {/* ── Mobile sidebar: overlay deslizante ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header
          className="lg:hidden flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ background: 'linear-gradient(90deg, #0c1d6e, #1538d0)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-white"
            style={{ background: 'rgba(255,255,255,0.15)' }}
            aria-label="Abrir menú"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="bg-white rounded-xl px-2 py-1">
            <Image
              src="/logoNexus.png"
              alt="NexusFac"
              width={110}
              height={44}
              className="h-19 w-auto object-contain"
              priority
            />
          </div>

          <div className="w-9" />
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
