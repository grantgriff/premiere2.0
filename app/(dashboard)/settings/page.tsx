'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, User, CreditCard, Bell, Shield, Palette } from 'lucide-react'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('account')

  const tabs = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'credits', label: 'Credits & Billing', icon: CreditCard },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'appearance', label: 'Appearance', icon: Palette },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="btn-ghost p-2">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        </div>
      </header>

      <div className="flex max-w-6xl mx-auto">
        {/* Sidebar */}
        <nav className="w-64 p-6 border-r border-border">
          <ul className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-accent/20 text-foreground'
                        : 'text-foreground-secondary hover:bg-background-secondary hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Content */}
        <main className="flex-1 p-6">
          {activeTab === 'account' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-foreground">Account Settings</h2>

              <div className="panel-secondary p-6 rounded-xl space-y-4">
                <div>
                  <label className="block text-sm text-foreground-secondary mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    className="input-field w-full max-w-md"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="block text-sm text-foreground-secondary mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    className="input-field w-full max-w-md"
                    placeholder="you@example.com"
                    disabled
                  />
                  <p className="text-xs text-foreground-secondary mt-1">
                    Connected via Google OAuth
                  </p>
                </div>

                <button className="btn-primary mt-4">Save Changes</button>
              </div>

              <div className="panel-secondary p-6 rounded-xl">
                <h3 className="font-medium text-error mb-2">Danger Zone</h3>
                <p className="text-sm text-foreground-secondary mb-4">
                  Once you delete your account, there is no going back.
                </p>
                <button className="px-4 py-2 bg-error/20 text-error rounded-lg hover:bg-error/30 transition-colors">
                  Delete Account
                </button>
              </div>
            </div>
          )}

          {activeTab === 'credits' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-foreground">Credits & Billing</h2>

              <div className="panel-secondary p-6 rounded-xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-foreground-secondary text-sm">Available Credits</p>
                    <p className="text-3xl font-bold text-foreground">100</p>
                  </div>
                  <button className="btn-primary">Buy Credits</button>
                </div>

                <div className="border-t border-border pt-4">
                  <h3 className="font-medium text-foreground mb-3">Credit Usage</h3>
                  <p className="text-sm text-foreground-secondary">
                    1 credit = 1 second of video generation
                  </p>
                </div>
              </div>

              <div className="panel-secondary p-6 rounded-xl">
                <h3 className="font-medium text-foreground mb-4">Pricing</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="border border-border rounded-lg p-4">
                    <p className="text-lg font-semibold">Starter</p>
                    <p className="text-2xl font-bold text-foreground my-2">$15</p>
                    <p className="text-sm text-foreground-secondary">500 credits</p>
                  </div>
                  <div className="border border-accent rounded-lg p-4 bg-accent/10">
                    <p className="text-lg font-semibold">Pro</p>
                    <p className="text-2xl font-bold text-foreground my-2">$49</p>
                    <p className="text-sm text-foreground-secondary">2000 credits</p>
                  </div>
                  <div className="border border-border rounded-lg p-4">
                    <p className="text-lg font-semibold">Enterprise</p>
                    <p className="text-2xl font-bold text-foreground my-2">Custom</p>
                    <p className="text-sm text-foreground-secondary">Contact us</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
              <div className="panel-secondary p-6 rounded-xl space-y-4">
                <p className="text-foreground-secondary">
                  Notification settings coming soon.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-foreground">Privacy</h2>
              <div className="panel-secondary p-6 rounded-xl space-y-4">
                <p className="text-foreground-secondary">
                  Privacy settings coming soon.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-foreground">Appearance</h2>
              <div className="panel-secondary p-6 rounded-xl space-y-4">
                <p className="text-foreground-secondary">
                  Dark theme is currently the only available theme.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
