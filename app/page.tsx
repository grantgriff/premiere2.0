'use client'

import { Sidebar } from '@/components/layout/Sidebar'
import { VideoPanel } from '@/components/layout/VideoPanel'
import { ChatPanel } from '@/components/layout/ChatPanel'

export default function Home() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Left Sidebar - 240px fixed */}
      <Sidebar />

      {/* Center Panel - Flexible */}
      <VideoPanel />

      {/* Right Sidebar - 360px fixed */}
      <ChatPanel />
    </div>
  )
}
