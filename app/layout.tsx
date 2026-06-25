import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from '@/components/providers'
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'Typerzy 2026 | FIFA World Cup',
  description: 'Prywatna liga typowania Mistrzostw Świata 2026',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Typerzy 2026',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
    icon: '/icons/icon-192.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#10b981',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>
        <Providers>{children}</Providers>
        <ServiceWorkerRegistrar />
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
