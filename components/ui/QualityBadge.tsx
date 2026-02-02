'use client'

import { useState } from 'react'
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX,
  ChevronDown, ChevronUp, AlertTriangle, Users,
  Eye, Zap, Film, Sparkles, Target
} from 'lucide-react'
import { QualityReport, QualityIssue, RiskFlag } from '@/lib/models/types'

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
  if (score >= 2) return 'Poor'
  return 'Very Poor'
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30'
    case 'high': return 'bg-red-400/20 text-red-400 border-red-400/30'
    case 'medium': return 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30'
    case 'low': return 'bg-gray-400/20 text-gray-400 border-gray-400/30'
    default: return 'bg-gray-400/20 text-gray-400 border-gray-400/30'
  }
}

function getRiskTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'violence': 'Violence',
    'inappropriate': 'Inappropriate',
    'bias_gender': 'Gender Bias',
    'bias_racial': 'Racial Bias',
    'bias_age': 'Age Bias',
    'lack_diversity': 'Diversity Issue',
    'stereotyping': 'Stereotyping',
    'misinformation': 'Misinformation',
    'other': 'Other Risk',
  }
  return labels[type] || type
}

function getIssueTypeIcon(type: string) {
  switch (type) {
    case 'anatomical_error': return Users
    case 'physics_violation': return Zap
    case 'temporal_glitch': return Film
    case 'uncanny_valley': return Eye
    default: return AlertTriangle
  }
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

  const hasCriticalRisks = report?.risks?.some(r => r.severity === 'critical')

  return (
    <div className="inline-block">
      <button
        onClick={(e) => {
          e.stopPropagation()
          if (showDetails) setExpanded(!expanded)
        }}
        className={`flex items-center gap-1.5 rounded-full border backdrop-blur-sm ${getScoreBgColor(score)} ${sizeClasses[size]} ${showDetails ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} transition-opacity ${hasCriticalRisks ? 'ring-2 ring-red-500/50' : ''}`}
      >
        <Icon className={`${iconSizes[size]} ${getScoreColor(score)}`} />
        <span className={getScoreColor(score)}>
          {score.toFixed(1)} - {getScoreLabel(score)}
        </span>
        {hasCriticalRisks && (
          <AlertTriangle className="w-3 h-3 text-red-400 animate-pulse" />
        )}
        {showDetails && report && (
          expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        )}
      </button>

      {expanded && report && (
        <div
          className="mt-2 p-4 rounded-lg bg-background-secondary border border-border text-sm max-w-md max-h-[320px] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Summary */}
          {report.summary && (
            <div className="mb-4 p-2 bg-background rounded border border-border">
              <p className="text-foreground-secondary text-xs italic">{report.summary}</p>
            </div>
          )}

          {/* Quality Dimensions */}
          <div className="space-y-2 mb-4">
            <h4 className="font-medium text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Quality Dimensions
            </h4>
            <div className="grid grid-cols-1 gap-2">
              <DimensionBar
                label="Prompt Accuracy"
                value={report.dimensions.promptAccuracy}
                icon={Target}
              />
              <DimensionBar
                label="Anatomical Accuracy"
                value={report.dimensions.anatomicalAccuracy}
                icon={Users}
              />
              <DimensionBar
                label="Physics Realism"
                value={report.dimensions.physicsRealism}
                icon={Zap}
              />
              <DimensionBar
                label="Temporal Consistency"
                value={report.dimensions.temporalConsistency}
                icon={Film}
              />
              <DimensionBar
                label="Visual Quality"
                value={report.dimensions.visualQuality}
                icon={Eye}
              />
            </div>
          </div>

          {/* Issues */}
          {report.issues && report.issues.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                Issues Detected ({report.issues.length})
              </h4>
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {report.issues.map((issue: QualityIssue, i: number) => {
                  const IssueIcon = getIssueTypeIcon(issue.type)
                  return (
                    <li key={i} className="flex items-start gap-2 p-2 rounded bg-background border border-border">
                      <IssueIcon className="w-4 h-4 text-foreground-secondary mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${getSeverityColor(issue.severity)}`}>
                            {issue.severity}
                          </span>
                          <span className="text-xs text-foreground-secondary capitalize">
                            {issue.type.replace(/_/g, ' ')}
                          </span>
                          {issue.timestamp !== undefined && (
                            <span className="text-xs text-foreground-secondary">
                              @{issue.timestamp}s
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-foreground-secondary">{issue.description}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Risks & Bias Alerts */}
          {report.risks && report.risks.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                Risks & Bias Alerts ({report.risks.length})
              </h4>
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {report.risks.map((risk: RiskFlag, i: number) => (
                  <li key={i} className={`p-2 rounded border ${risk.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' : 'bg-background border-border'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${getSeverityColor(risk.severity)}`}>
                        {risk.severity}
                      </span>
                      <span className="text-xs font-medium text-foreground">
                        {getRiskTypeLabel(risk.type)}
                      </span>
                    </div>
                    <p className="text-xs text-foreground-secondary mb-1">{risk.description}</p>
                    {risk.recommendation && (
                      <p className="text-xs text-blue-400 italic">
                        → {risk.recommendation}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Character Comparison */}
          {report.characterComparison && (
            <div className="mb-4">
              <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                Character Match
              </h4>
              <div className="p-2 rounded bg-background border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-foreground-secondary">Match Score</span>
                  <span className={`text-sm font-medium ${getScoreColor(report.characterComparison.matchScore)}`}>
                    {report.characterComparison.matchScore.toFixed(1)}/10
                  </span>
                </div>
                <div className="h-2 bg-background-secondary rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      report.characterComparison.matchScore >= 8 ? 'bg-green-400' :
                      report.characterComparison.matchScore >= 6 ? 'bg-yellow-400' :
                      report.characterComparison.matchScore >= 4 ? 'bg-orange-400' :
                      'bg-red-400'
                    }`}
                    style={{ width: `${(report.characterComparison.matchScore / 10) * 100}%` }}
                  />
                </div>
                {report.characterComparison.differences && report.characterComparison.differences.length > 0 && (
                  <div className="space-y-1 mt-2">
                    <p className="text-xs font-medium text-foreground-secondary">Differences:</p>
                    {report.characterComparison.differences.map((diff, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={`px-1 py-0.5 rounded ${
                          diff.severity === 'significant' ? 'bg-red-400/20 text-red-400' :
                          diff.severity === 'moderate' ? 'bg-yellow-400/20 text-yellow-400' :
                          'bg-gray-400/20 text-gray-400'
                        }`}>
                          {diff.aspect}
                        </span>
                        <span className="text-foreground-secondary">{diff.description}</span>
                      </div>
                    ))}
                  </div>
                )}
                {report.characterComparison.overallAssessment && (
                  <p className="text-xs text-foreground-secondary italic mt-2 pt-2 border-t border-border">
                    {report.characterComparison.overallAssessment}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* No issues message */}
          {(!report.issues || report.issues.length === 0) &&
           (!report.risks || report.risks.length === 0) && (
            <p className="text-foreground-secondary text-xs text-center py-2">
              No significant issues or risks detected
            </p>
          )}
        </div>
      )}
    </div>
  )
}

interface DimensionBarProps {
  label: string
  value: number
  icon?: React.ComponentType<{ className?: string }>
}

function DimensionBar({ label, value, icon: Icon }: DimensionBarProps) {
  const percentage = (value / 10) * 100

  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-foreground-secondary flex items-center gap-1">
          {Icon && <Icon className="w-3 h-3" />}
          {label}
        </span>
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
