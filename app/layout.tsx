import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'VideoCraft AI - Model-Agnostic Video Generation Platform',
  description: 'Generate high-quality AI videos from text, images, or video inputs using multiple cutting-edge AI models.',
  keywords: ['AI video generation', 'text-to-video', 'Veo', 'Runway', 'Luma AI', 'Sora'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
