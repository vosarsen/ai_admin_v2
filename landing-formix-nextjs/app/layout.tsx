import type { Metadata } from 'next'
import { Inter, Geist } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
})

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  weight: ['600', '700', '900'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Admin AI beta - Умный WhatsApp бот для салонов красоты',
  description: 'Автоматизация записей, ответов на вопросы и напоминаний клиентам 24/7',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" className={`${inter.variable} ${geist.variable}`}>
      <body>{children}</body>
    </html>
  )
}
