import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { GymSettingsProvider } from '@/contexts/GymSettingsContext'

export const metadata: Metadata = {
  title: 'FitNix Track Admin Portal',
  description: 'Gym Management System',
  icons: {
    icon: '/logo.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <GymSettingsProvider>{children}</GymSettingsProvider>
        </AuthProvider>
      </body>
    </html>
  )
}

















