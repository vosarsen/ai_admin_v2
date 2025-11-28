'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export default function Hero() {
  return (
    <section className="min-h-screen flex items-center justify-center px-8 pt-32 pb-20 relative overflow-hidden">
      {/* Gradient Background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, rgba(255, 55, 0, 0.05) 0%, transparent 70%)'
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {/* Available Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <span
            className="inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-full font-semibold text-sm hover:scale-105 hover:shadow-xl transition-all cursor-pointer"
            style={{ backgroundColor: 'var(--color-text-primary)' }}
          >
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-primary)' }} />
            Available For Projects
          </span>
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="font-black text-5xl md:text-6xl lg:text-7xl tracking-tight leading-tight mb-6 text-balance"
          style={{ fontFamily: 'var(--font-geist)' }}
        >
          Умный WhatsApp бот
          <br />
          для салонов красоты
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg md:text-xl leading-relaxed mb-10 max-w-2xl mx-auto"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Автоматизируйте запись клиентов, ответы на вопросы и напоминания 24/7.
          <br />
          Интеграция с YClients за 24 часа.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="#contact"
            className="inline-flex items-center gap-2 px-8 py-4 text-white font-bold rounded-full hover:scale-105 hover:shadow-2xl transition-all text-lg group"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Начать бесплатно
            <svg
              className="w-5 h-5 group-hover:translate-x-1 transition-transform"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path
                d="M3 8H13M13 8L8 3M13 8L8 13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>

          <Link
            href="#demo"
            className="inline-flex items-center gap-2 px-8 py-4 bg-transparent border-2 font-bold rounded-full hover:scale-105 hover:shadow-xl transition-all text-lg group"
            style={{
              borderColor: 'var(--color-text-primary)',
              color: 'var(--color-text-primary)'
            }}
          >
            Посмотреть демо
            <svg
              className="w-5 h-5 group-hover:translate-x-1 transition-transform"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path
                d="M3 8H13M13 8L8 3M13 8L8 13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
