'use client'

import { useState, useEffect, useCallback } from 'react'

const ONBOARDING_KEY = 'premiere_onboarding_complete'

interface Step {
  target: string // data-onboarding attribute value
  title: string
  description: string
  position: 'right' | 'left' | 'top' | 'bottom'
}

const STEPS: Step[] = [
  {
    target: 'new-button',
    title: 'Create Clips & Movies',
    description: 'Start a new clip to generate a single video, or create a movie to stitch multiple clips into a sequence.',
    position: 'right',
  },
  {
    target: 'model-selection',
    title: 'Pick a Model & Duration',
    description: 'Choose an AI model (try Veo 3.1 for best quality) and set your clip duration. Select multiple models to compare outputs side-by-side.',
    position: 'left',
  },
  {
    target: 'character-button',
    title: 'Create & Tag Characters',
    description: 'Upload a character photo, then tag them with @ in your prompt to keep a consistent look across clips. Veo 3.1 supports image references — other models use a text description.',
    position: 'left',
  },
  {
    target: 'generate-button',
    title: 'Generate Your Video',
    description: 'Type a prompt describing your scene and hit Generate. Your video will appear in the center panel when ready.',
    position: 'left',
  },
]

export function OnboardingOverlay() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({})

  useEffect(() => {
    // Check if user has already completed onboarding
    if (localStorage.getItem(ONBOARDING_KEY)) return

    // Small delay so the DOM is painted
    const timer = setTimeout(() => setIsVisible(true), 800)
    return () => clearTimeout(timer)
  }, [])

  const positionTooltip = useCallback(() => {
    if (!isVisible) return

    const step = STEPS[currentStep]
    const el = document.querySelector(`[data-onboarding="${step.target}"]`)
    if (!el) return

    const rect = el.getBoundingClientRect()
    const pad = 8

    // Highlight rect
    setHighlightStyle({
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    })

    // Tooltip positioning
    const tooltip: React.CSSProperties = {}
    const tooltipWidth = 300

    switch (step.position) {
      case 'right':
        tooltip.top = rect.top
        tooltip.left = rect.right + pad + 16
        break
      case 'left':
        tooltip.top = rect.top
        tooltip.left = rect.left - pad - 16 - tooltipWidth
        break
      case 'bottom':
        tooltip.top = rect.bottom + pad + 16
        tooltip.left = rect.left + rect.width / 2 - tooltipWidth / 2
        break
      case 'top':
        tooltip.top = rect.top - pad - 16 - 120
        tooltip.left = rect.left + rect.width / 2 - tooltipWidth / 2
        break
    }

    // Clamp to viewport
    if ((tooltip.left as number) < 16) tooltip.left = 16
    if ((tooltip.top as number) < 16) tooltip.top = 16

    setTooltipStyle(tooltip)
  }, [isVisible, currentStep])

  useEffect(() => {
    positionTooltip()
    window.addEventListener('resize', positionTooltip)
    return () => window.removeEventListener('resize', positionTooltip)
  }, [positionTooltip])

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
      {/* Dark overlay with cutout */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.65)' }} />

      {/* Highlight cutout */}
      <div
        className="absolute rounded-lg ring-2 ring-accent ring-offset-2 ring-offset-transparent transition-all duration-300 ease-out"
        style={{
          ...highlightStyle,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
          background: 'transparent',
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
