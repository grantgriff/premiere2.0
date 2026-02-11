'use client'

import { useState } from 'react'
import {
  Sparkles,
  Wand2,
  Users,
  Send,
  Loader2,
  CheckCircle,
  XCircle,
  Shield,
  ChevronDown,
  ChevronRight,
  Clock,
  Zap,
  Film,
} from 'lucide-react'

export type TraceStepStatus = 'pending' | 'active' | 'completed' | 'failed'

export interface TraceStep {
  id: string
  label: string
  detail?: string
  expandedContent?: string
  status: TraceStepStatus
  icon: 'prompt' | 'enhance' | 'characters' | 'submit' | 'generate' | 'quality' | 'complete' | 'error' | 'continuity'
  timestamp?: Date
}

interface AgenticTraceProps {
  originalPrompt: string
  steps: TraceStep[]
  isActive: boolean
}

const ICON_MAP = {
  prompt: Sparkles,
  enhance: Wand2,
  characters: Users,
  submit: Send,
  generate: Zap,
  quality: Shield,
  complete: CheckCircle,
  error: XCircle,
  continuity: Film,
}

function TraceStepRow({ step }: { step: TraceStep }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const Icon = ICON_MAP[step.icon]
  const hasExpandedContent = !!step.expandedContent

  return (
    <div className="relative pl-6">
      {/* Vertical connector line */}
      <div className="absolute left-[9px] top-0 bottom-0 w-px bg-border" />

      {/* Step dot/icon */}
      <div className={`absolute left-0 top-1 w-[19px] h-[19px] rounded-full flex items-center justify-center z-10 ${
        step.status === 'completed' ? 'bg-green-500/20 text-green-400' :
        step.status === 'active' ? 'bg-accent/20 text-accent' :
        step.status === 'failed' ? 'bg-red-500/20 text-red-400' :
        'bg-[#2a2a2a] text-foreground-secondary'
      }`}>
        {step.status === 'active' ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : step.status === 'completed' ? (
          <CheckCircle className="w-3 h-3" />
        ) : step.status === 'failed' ? (
          <XCircle className="w-3 h-3" />
        ) : (
          <Icon className="w-3 h-3" />
        )}
      </div>

      {/* Step content */}
      <div className="pb-4">
        <button
          onClick={() => hasExpandedContent && setIsExpanded(!isExpanded)}
          className={`flex items-center gap-1.5 w-full text-left ${
            hasExpandedContent ? 'cursor-pointer hover:text-foreground' : 'cursor-default'
          }`}
        >
          <span className={`text-xs font-medium ${
            step.status === 'active' ? 'text-accent' :
            step.status === 'completed' ? 'text-foreground' :
            step.status === 'failed' ? 'text-red-400' :
            'text-foreground-secondary'
          }`}>
            {step.label}
          </span>
          {step.status === 'active' && (
            <span className="text-[10px] text-accent/60 animate-pulse">running</span>
          )}
          {hasExpandedContent && (
            isExpanded ?
              <ChevronDown className="w-3 h-3 text-foreground-secondary ml-auto flex-shrink-0" /> :
              <ChevronRight className="w-3 h-3 text-foreground-secondary ml-auto flex-shrink-0" />
          )}
        </button>

        {/* Detail text (always visible) */}
        {step.detail && (
          <p className="text-[11px] text-foreground-secondary mt-0.5 leading-relaxed">
            {step.detail}
          </p>
        )}

        {/* Expanded content (collapsible) */}
        {isExpanded && step.expandedContent && (
          <div className="mt-2 px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
            <p className="text-[11px] text-foreground-secondary/80 leading-relaxed whitespace-pre-wrap font-mono">
              {step.expandedContent}
            </p>
          </div>
        )}

        {/* Timestamp */}
        {step.timestamp && step.status === 'completed' && (
          <div className="flex items-center gap-1 mt-1">
            <Clock className="w-2.5 h-2.5 text-foreground-secondary/40" />
            <span className="text-[10px] text-foreground-secondary/40">
              {step.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function AgenticTrace({ originalPrompt, steps, isActive }: AgenticTraceProps) {
  return (
    <div className="space-y-0">
      {/* Original prompt header */}
      <div className="flex items-start gap-2.5 mb-4">
        <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground leading-relaxed">{originalPrompt}</p>
        </div>
      </div>

      {/* Trace steps */}
      <div className="ml-3">
        {steps.map((step) => (
          <TraceStepRow key={step.id} step={step} />
        ))}

        {/* Active indicator at the end */}
        {isActive && (
          <div className="relative pl-6">
            <div className="absolute left-[7px] top-1 w-[5px] h-[5px] rounded-full bg-accent animate-pulse" />
          </div>
        )}
      </div>
    </div>
  )
}
