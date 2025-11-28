'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const navLinks = [
    { href: '#features', label: 'Возможности' },
    { href: '#demo', label: 'Демо' },
    { href: '#pricing', label: 'Цены' },
    { href: '#faq', label: 'FAQ' },
  ]

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-8 pt-6">
      <div className="max-w-[1270px] mx-auto px-8 py-4 flex items-center gap-8 backdrop-blur-xl rounded-full border border-gray-200/50" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
        {/* Logo */}
        <Link
          href="/"
          className="mr-auto font-black text-xl tracking-tight hover:opacity-70 transition-opacity"
          style={{ fontFamily: 'var(--font-geist)' }}
        >
          Admin AI
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-medium hover:opacity-70 transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:block">
          <Link
            href="#contact"
            className="inline-flex items-center gap-2 px-6 py-3 text-white font-semibold rounded-full hover:scale-105 hover:shadow-lg transition-all"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Попробовать бесплатно
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13M13 8L8 3M13 8L8 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="md:hidden flex flex-col gap-1.5 w-10 h-10 items-center justify-center hover:bg-black/5 rounded transition-colors"
          aria-label="Toggle menu"
        >
          <span className={`w-6 h-0.5 transition-transform ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`} style={{ backgroundColor: 'var(--color-text-primary)' }} />
          <span className={`w-6 h-0.5 transition-opacity ${isMenuOpen ? 'opacity-0' : ''}`} style={{ backgroundColor: 'var(--color-text-primary)' }} />
          <span className={`w-6 h-0.5 transition-transform ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} style={{ backgroundColor: 'var(--color-text-primary)' }} />
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <nav className="md:hidden mt-4 mx-8 backdrop-blur-xl rounded-3xl border border-gray-200/50" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
          <div className="px-8 py-6 flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className="font-medium py-2"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="#contact"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-white font-semibold rounded-full hover:scale-105 hover:shadow-lg transition-all mt-2"
              style={{ backgroundColor: 'var(--color-primary)' }}
              onClick={() => setIsMenuOpen(false)}
            >
              Попробовать бесплатно
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                <path d="M3 8H13M13 8L8 3M13 8L8 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        </nav>
      )}
    </header>
  )
}
