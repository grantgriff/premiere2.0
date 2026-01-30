'use client'

import { useState } from 'react'
import { Shield, ShieldCheck, ShieldAlert, ShieldX, ChevronDown, ChevronUp } from 'lucide-react'
import { QualityReport } from '@/lib/models/types'

interface QualityBadgeProps {
  score: number | null
  report?: QualityReport | null
  size?: 'sm' | 'md' | 'lg'
  showDetails?: boolean
}

function getScoreColor(score: number): string {
  if (score >= 8) return 'text-green-400'
  if (score >= 6) return 'text-yellow-400'
  if (score >= 4) return 'text-orange-400'
  return 'text-red-400'
}

function getScoreBgColor(score: number): string {
  if (score >= 8) return 'bg-green-400/10 border-green-400/30'
  if (score >= 6) return 'bg-yellow-400/10 border-yellow-400/30'
  if (score >= 4) return 'bg-orange-400/10 border-orange-400/30'
  return 'bg-red-400/10 border-red-400/30'
}

function getScoreIcon(score: number) {
  if (score >= 8) return ShieldCheck
  if (score >= 6) return Shield
  if (score >= 4) return ShieldAlert
  return ShieldX
}

function getScoreLabel(score: number): string {
  if (score >= 8) return 'Excellent'
  if (score >= 6) return 'Good'
  if (score >= 4) return 'Fair'
  return 'Poor'
}

export function QualityBadge({ score, report, size = 'md', showDetails = true }: QualityBadgeProps) {
  const [expanded, setExpanded] = useState(false)

  if (score === null || score === undefined) {
    return (
      <div className="flex items-center gap-1.5 text-foreground-secondary text-sm">
        <Shield className="w-4 h-4 animate-pulse" />
        <span>Analyzing...</span>
      </div>
    )
  }

  const Icon = getScoreIcon(score)
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  }

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }

  return (
    <div className="inline-block">
      <button
        onClick={() => showDetails && setExpanded(!expanded)}
        className={`flex items-center gap-1.5 rounded-full border ${getScoreBgColor(score)} ${sizeClasses[size]} ${showDetails ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} transition-opacity`}
      >
        <Icon className={`${iconSizes[size]} ${getScoreColor(score)}`} />
        <span className={getScoreColor(score)}>
          {score.toFixed(1)} - {getScoreLabel(score)}
        </span>
        {showDetails && report && (
          expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        )}
      </button>

      {expanded && report && (
        <div className="mt-2 p-3 rounded-lg bg-background-secondary border border-border text-sm">
          {/* Dimension scores */}
          <div className="space-y-2 mb-3">
            <h4 className="font-medium text-foreground">Quality Dimensions</h4>
            <div className="grid grid-cols-2 gap-2">
              <DimensionBar label="Accuracy" value={report.dimensions.accuracy} />
              <DimensionBar label="Faces" value={report.dimensions.facialQuality} />
              <DimensionBar label="Objects" value={report.dimensions.objectCoherence} />
              <DimensionBar label="Lighting" value={report.dimensions.lightingConsistency} />
              <DimensionBar label="Motion" value={report.dimensions.motionSmoothness} />
            </div>
          </div>

          {/* Issues */}
          {report.issues.length > 0 && (
            <div className="mb-3">
              <h4 className="font-medium text-foreground mb-1">Issues Detected</h4>
              <ul className="space-y-1">
                {report.issues.map((issue, i) => (
                  <li key={i} className="flex items-start gap-2 text-foreground-secondary">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      issue.severity === 'high' ? 'bg-red-400/20 text-red-400' :
                      issue.severity === 'medium' ? 'bg-yellow-400/20 text-yellow-400' :
                      'bg-gray-400/20 text-gray-400'
                    }`}>
                      {issue.severity}
                    </span>
                    <span className="text-xs">{issue.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Bias flags */}
          {report.biasFlags.length > 0 && (
            <div>
              <h4 className="font-medium text-foreground mb-1">Bias Alerts</h4>
              <ul className="space-y-1">
                {report.biasFlags.map((flag, i) => (
                  <li key={i} className="flex items-start gap-2 text-foreground-secondary">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      flag.severity === 'high' ? 'bg-red-400/20 text-red-400' :
                      flag.severity === 'medium' ? 'bg-yellow-400/20 text-yellow-400' :
                      'bg-gray-400/20 text-gray-400'
                    }`}>
                      {flag.type}
                    </span>
                    <span className="text-xs">{flag.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.issues.length === 0 && report.biasFlags.length === 0 && (
            <p className="text-foreground-secondary text-xs">No issues detected</p>
          )}
        </div>
      )}
    </div>
  )
}

function DimensionBar({ label, value }: { label: string; value: number }) {
  const percentage = (value / 10) * 100

  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-foreground-secondary">{label}</span>
        <span className={getScoreColor(value)}>{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 bg-background rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            value >= 8 ? 'bg-green-400' :
            value >= 6 ? 'bg-yellow-400' :
            value >= 4 ? 'bg-orange-400' :
            'bg-red-400'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
