import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from '@/components/providers'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'Typerzy 2026 | FIFA World Cup',
  description: 'Prywatna liga typowania Mistrzostw Świata 2026',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>
        <Providers>{children}</Providers>
        <Toaster
          theme="dark"
          position="bottom-center"
          toastOptions={{
            style: {
              background: '#111827',
              border: '1px solid #1f2937',
              color: '#f9fafb',
            },
          }}
        />
      </body>
    </html>
  )
}
