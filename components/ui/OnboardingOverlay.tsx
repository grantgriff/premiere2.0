'use client'

import { useState, useEffect, useCallback } from 'react'

const ONBOARDING_KEY = 'premiere_onboarding_complete'

interface Step {
  target: string // data-onboarding attribute value
  title: string
  description: string
  preferredSide: 'right' | 'left' | 'top' | 'bottom'
}

const STEPS: Step[] = [
  {
    target: 'new-button',
    title: 'Create Clips & Movies',
    description: 'Start a new clip to generate a single video, or create a movie to stitch multiple clips into a sequence.',
    preferredSide: 'right',
  },
  {
    target: 'model-selection',
    title: 'Pick a Model & Duration',
    description: 'Choose an AI model (try Veo 3.1 for best quality) and set your clip duration. Select multiple models to compare outputs side-by-side.',
    preferredSide: 'top',
  },
  {
    target: 'character-button',
    title: 'Create & Tag Characters',
    description: 'Upload a character photo, then tag them with @ in your prompt to keep a consistent look across clips. Veo 3.1 supports image references — other models use a text description.',
    preferredSide: 'top',
  },
  {
    target: 'generate-button',
    title: 'Generate Your Video',
    description: 'Type a prompt describing your scene and hit Generate. Your video will appear in the center panel when ready.',
    preferredSide: 'bottom',
  },
]

const TOOLTIP_WIDTH = 300
const TOOLTIP_HEIGHT_EST = 180 // rough estimate for clamping
const GAP = 16
const PAD = 8
const VIEWPORT_MARGIN = 16

export function OnboardingOverlay() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({})

  useEffect(() => {
    if (localStorage.getItem(ONBOARDING_KEY)) return
    const timer = setTimeout(() => setIsVisible(true), 800)
    return () => clearTimeout(timer)
  }, [])

  // Allow manual trigger from anywhere via custom event
  useEffect(() => {
    const handleStart = () => {
      setCurrentStep(0)
      setIsVisible(true)
    }
    window.addEventListener('start-onboarding', handleStart)
    return () => window.removeEventListener('start-onboarding', handleStart)
  }, [])

  const positionElements = useCallback(() => {
    if (!isVisible) return

    const step = STEPS[currentStep]
    // Find all matching elements and pick the first one that's actually visible
    const candidates = document.querySelectorAll(`[data-onboarding="${step.target}"]`)
    let el: Element | null = null
    for (const candidate of candidates) {
      const r = candidate.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) {
        el = candidate
        break
      }
    }
    if (!el) return

    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    // Highlight rect
    setHighlightStyle({
      top: rect.top - PAD,
      left: rect.left - PAD,
      width: rect.width + PAD * 2,
      height: rect.height + PAD * 2,
    })

    // Calculate best tooltip position — try preferred side first, then fallback
    let top = 0
    let left = 0

    const fitRight = rect.right + GAP + TOOLTIP_WIDTH + VIEWPORT_MARGIN < vw
    const fitLeft = rect.left - GAP - TOOLTIP_WIDTH - VIEWPORT_MARGIN > 0
    const fitBelow = rect.bottom + GAP + TOOLTIP_HEIGHT_EST + VIEWPORT_MARGIN < vh
    const fitAbove = rect.top - GAP - TOOLTIP_HEIGHT_EST - VIEWPORT_MARGIN > 0

    const placeRight = () => {
      left = rect.right + GAP
      top = rect.top
    }
    const placeLeft = () => {
      left = rect.left - GAP - TOOLTIP_WIDTH
      top = rect.top
    }
    const placeBelow = () => {
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2
      top = rect.bottom + GAP
    }
    const placeAbove = () => {
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2
      top = rect.top - GAP - TOOLTIP_HEIGHT_EST
    }

    // Try preferred side, then try alternatives
    switch (step.preferredSide) {
      case 'right':
        if (fitRight) placeRight()
        else if (fitLeft) placeLeft()
        else if (fitBelow) placeBelow()
        else placeAbove()
        break
      case 'left':
        if (fitLeft) placeLeft()
        else if (fitRight) placeRight()
        else if (fitBelow) placeBelow()
        else placeAbove()
        break
      case 'bottom':
        if (fitBelow) placeBelow()
        else if (fitAbove) placeAbove()
        else if (fitRight) placeRight()
        else placeLeft()
        break
      case 'top':
        if (fitAbove) placeAbove()
        else if (fitBelow) placeBelow()
        else if (fitLeft) placeLeft()
        else placeRight()
        break
    }

    // Clamp to viewport
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - TOOLTIP_WIDTH - VIEWPORT_MARGIN))
    top = Math.max(VIEWPORT_MARGIN, Math.min(top, vh - TOOLTIP_HEIGHT_EST - VIEWPORT_MARGIN))

    setTooltipStyle({ top, left })
  }, [isVisible, currentStep])

  useEffect(() => {
    positionElements()
    window.addEventListener('resize', positionElements)
    return () => window.removeEventListener('resize', positionElements)
  }, [positionElements])

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleDismiss()
    }
  }

  const handleDismiss = () => {
    setIsVisible(false)
    localStorage.setItem(ONBOARDING_KEY, 'true')
  }

  if (!isVisible) return null

  const step = STEPS[currentStep]

  return (
    <div className="fixed inset-0 z-[100]" onClick={handleDismiss}>
      {/* Lighter overlay — lets the UI show through */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)' }} />

      {/* Spotlight highlight around target element */}
      <div
        className="absolute rounded-lg transition-all duration-300 ease-out"
        style={{
          ...highlightStyle,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.45), 0 0 24px 4px rgba(139,115,64,0.4)',
          background: 'transparent',
          border: '2px solid rgba(139,115,64,0.8)',
          zIndex: 101,
          pointerEvents: 'none',
        }}
      />

      {/* Tooltip */}
      <div
        className="absolute w-[300px] bg-[#1a1a1a] border border-[#3a3a3a] rounded-xl shadow-2xl p-5 transition-all duration-300 ease-out"
        style={{ ...tooltipStyle, zIndex: 102 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-3">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === currentStep ? 'w-6 bg-accent' : i < currentStep ? 'w-3 bg-accent/40' : 'w-3 bg-[#3a3a3a]'
              }`}
            />
          ))}
          <span className="ml-auto text-xs text-foreground-secondary">
            {currentStep + 1}/{STEPS.length}
          </span>
        </div>

        <h3 className="text-sm font-semibold text-foreground mb-1.5">{step.title}</h3>
        <p className="text-xs text-foreground-secondary leading-relaxed mb-4">{step.description}</p>

        <div className="flex items-center justify-between">
          <button
            onClick={handleDismiss}
            className="text-xs text-foreground-secondary hover:text-foreground transition-colors"
          >
            Skip tour
          </button>
          <button
            onClick={handleNext}
            className="px-4 py-1.5 text-xs font-medium bg-accent hover:bg-accent/90 text-white rounded-lg transition-colors"
          >
            {currentStep < STEPS.length - 1 ? 'Next' : 'Get Started'}
          </button>
        </div>
      </div>
    </div>
  )
}
