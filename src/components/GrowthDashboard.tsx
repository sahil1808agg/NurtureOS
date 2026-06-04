import React from 'react'
import DevelopmentRadar from './RadarChart'

interface GrowthDashboardProps {
  childName: string
  age: string
  location: string
  activitiesRaw: unknown
  onBack: () => void
  onRestart: () => void
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Activity {
  activityId: string
  name: string
  type: string
  targetDomains: string[]
  developmentalRationale: string
  location: { name: string; address: string; distanceKm: number }
  schedule: 'weekday' | 'weekend' | string
  timing: string
  ageRange: string
  matchScore: number
  googleRating: number
  reviewHighlight: string
  estimatedCost: string
  bookingNote: string
}

interface ParsedResponse {
  activities: Activity[]
  topPick: string
  topPickReason: string
  developmentAxes?: Record<string, { score: number; note: string }>
  childSummary?: string
}

// ─── Parse webhook response ───────────────────────────────────────────────────
function parseActivities(raw: unknown): ParsedResponse | null {
  if (!raw) return null
  try {
    // Recursively unwrap all n8n envelope formats:
    // [{"output":"..."}], [{"text":"..."}], {"output":{...}}, markdown fences, etc.
    const unwrap = (v: unknown): unknown => {
      if (!v) return null

      // Array → unwrap first item
      if (Array.isArray(v)) {
        for (const item of v) {
          const r = unwrap(item)
          if (r) return r
        }
        return null
      }

      // String → extract JSON from inside code fences if present, else parse directly
      if (typeof v === 'string') {
        const trimmed = v.trim()
        if (!trimmed) return null
        // Try to extract content between ```json ... ``` or ``` ... ``` first
        const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/)
        if (fenceMatch) {
          try { return unwrap(JSON.parse(fenceMatch[1])) } catch { /* fall through */ }
        }
        // No fences — try parsing the whole string as JSON
        try { return unwrap(JSON.parse(trimmed)) } catch { return null }
      }

      if (typeof v !== 'object') return null
      const o = v as Record<string, unknown>

      // Already the payload
      if (o.activities) return o

      // n8n AI Agent wraps final answer in "output"
      if (o.output !== undefined) {
        const r = unwrap(o.output)
        if (r) return r
      }

      // n8n LLM node wraps in "text"
      if (o.text !== undefined) {
        const r = unwrap(o.text)
        if (r) return r
      }

      // Other common wrappers
      for (const key of ['data', 'result', 'message', 'content', 'response']) {
        if (o[key]) {
          const r = unwrap(o[key])
          if (r) return r
        }
      }

      return null
    }

    console.log('[GrowthDashboard] parseActivities input:', raw)
    const payload = unwrap(raw) as Record<string, unknown> | null
    console.log('[GrowthDashboard] extracted payload:', payload)
    if (!payload?.activities) return null

    const acts = (payload.activities as Record<string, unknown>[]).map((a, i) => ({
      activityId:             String(a.activityId             ?? `act_${i}`),
      name:                   String(a.name                   ?? ''),
      type:                   String(a.type                   ?? ''),
      targetDomains:          Array.isArray(a.targetDomains)  ? a.targetDomains.map(String) : [],
      developmentalRationale: String(a.developmentalRationale ?? ''),
      location: {
        name:        String((a.location as Record<string,unknown>)?.name        ?? ''),
        address:     String((a.location as Record<string,unknown>)?.address     ?? ''),
        distanceKm:  Number((a.location as Record<string,unknown>)?.distanceKm  ?? 0),
      },
      schedule:       String(a.schedule       ?? ''),
      timing:         String(a.timing         ?? ''),
      ageRange:       String(a.ageRange        ?? ''),
      matchScore:     Number(a.matchScore      ?? 0),
      googleRating:   Number(a.googleRating    ?? 0),
      reviewHighlight:String(a.reviewHighlight ?? ''),
      estimatedCost:  String(a.estimatedCost   ?? ''),
      bookingNote:    String(a.bookingNote     ?? ''),
    }))

    return {
      activities:     acts,
      topPick:        String(payload.topPick        ?? ''),
      topPickReason:  String(payload.topPickReason  ?? ''),
      developmentAxes: payload.developmentAxes as Record<string, { score: number; note: string }> | undefined,
      childSummary:   String(payload.childSummary   ?? ''),
    }
  } catch {
    return null
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DOMAIN_COLORS: Record<string, string> = {
  Social:     'bg-blue-100 text-blue-700',
  Cognitive:  'bg-purple-100 text-purple-700',
  Physical:   'bg-green-100 text-green-700',
  Creative:   'bg-pink-100 text-pink-700',
  Emotional:  'bg-yellow-100 text-yellow-700',
  Behavioural:'bg-orange-100 text-orange-700',
  Behavioral: 'bg-orange-100 text-orange-700',
  Sensory:    'bg-teal-100 text-teal-700',
}

function googleMapsUrl(address: string, name: string) {
  const q = encodeURIComponent(`${name} ${address}`)
  return `https://www.google.com/maps/search/?api=1&query=${q}`
}

function matchColor(score: number) {
  if (score >= 90) return 'bg-emerald-500'
  if (score >= 75) return 'bg-blue-500'
  return 'bg-amber-500'
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-1 text-xs text-amber-500 font-semibold">
      ★ {rating.toFixed(1)}
    </span>
  )
}

// Static radar fallback
const FALLBACK_RADAR = [
  { axis: 'Logic',    value: 70 },
  { axis: 'Motor',    value: 60 },
  { axis: 'Social',   value: 65 },
  { axis: 'Creative', value: 80 },
  { axis: 'Emotional',value: 60 },
]

export default function GrowthDashboard({ childName, age, location, activitiesRaw, onBack, onRestart }: GrowthDashboardProps) {
  const parsed    = parseActivities(activitiesRaw)
  const activities = parsed?.activities ?? []

  const displayName     = childName || 'Child'
  const displayAge      = age       || '—'
  const displayLocation = location  || '—'

  // Build radar data from developmentAxes if available
  const radarData = parsed?.developmentAxes
    ? Object.entries(parsed.developmentAxes).map(([axis, v]) => ({ axis, value: v.score * 10 }))
    : FALLBACK_RADAR

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          <span>🌱</span> Step 4 of 4
        </div>
      </div>

      {/* Child profile card */}
      <div className="bg-gradient-to-r from-primary-600 to-indigo-600 rounded-2xl p-5 mb-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
        <div className="absolute bottom-0 left-1/2 w-24 h-24 bg-white/5 rounded-full translate-y-8" />
        <div className="relative">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-bold">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-xl font-bold">{displayName}</h3>
              <div className="flex items-center gap-3 mt-1 text-primary-100 text-sm">
                <span>Age {displayAge}</span>
                <span className="w-1 h-1 bg-primary-200 rounded-full" />
                <span>{displayLocation}</span>
              </div>
            </div>
          </div>
          {parsed?.childSummary && (
            <p className="mt-3 text-sm text-primary-100 leading-relaxed">{parsed.childSummary}</p>
          )}
        </div>
      </div>

      {/* ── 5-Axis Developmental Profile (always visible) ── */}
      <div className="card mb-6">
        <h3 className="font-bold text-gray-900 mb-1">5-Axis Developmental Profile</h3>
        <p className="text-xs text-gray-500 mb-4">Based on your inputs, school report, and conflict resolutions.</p>
        <DevelopmentRadar data={radarData} />
        <div className="mt-4 grid grid-cols-5 gap-2">
          {radarData.map(item => (
            <div key={item.axis} className="text-center">
              <div className="text-sm font-bold text-primary-700">{item.value}%</div>
              <div className="text-xs text-gray-500 mt-0.5">{item.axis}</div>
            </div>
          ))}
        </div>
        {parsed?.developmentAxes && (
          <div className="mt-4 space-y-1">
            {Object.entries(parsed.developmentAxes).map(([axis, v]) => (
              <div key={axis} className="flex items-center gap-2 text-xs text-gray-500">
                <span className="font-semibold text-gray-700 w-20">{axis}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                  <div className="bg-primary-500 h-1.5 rounded-full" style={{ width: `${v.score * 10}%` }} />
                </div>
                <span className="w-28 text-gray-400">{v.note}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Activities ── */}
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Recommended Activities</h2>
        <p className="text-xs text-gray-500">Local activities matched to {displayName}'s developmental profile.</p>
      </div>

      {activities.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-400 mb-6">
          No activities loaded yet. Complete the previous steps to get personalised recommendations.
        </div>
      )}

      <div className="space-y-4 mb-6">
        {activities.map((act, idx) => {
          const isTopPick = act.activityId === parsed?.topPick
          return (
            <div
              key={act.activityId}
              className={`card border-l-4 hover:shadow-md transition-shadow relative ${
                isTopPick ? 'border-l-emerald-500' : 'border-l-primary-400'
              }`}
            >
              {isTopPick && (
                <span className="absolute top-3 right-3 text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                  ⭐ Top Pick
                </span>
              )}

              {/* Title row */}
              <div className="flex items-start gap-2 mb-2 pr-20">
                <span className="text-xs font-bold text-gray-400 mt-1">#{idx + 1}</span>
                <div>
                  <h4 className="font-bold text-gray-900 text-base leading-tight">{act.name}</h4>
                  <p className="text-xs text-gray-400 mt-0.5">{act.type}</p>
                </div>
              </div>

              {/* Rationale */}
              <p className="text-gray-500 text-sm mb-3 leading-relaxed">{act.developmentalRationale}</p>

              {/* Tags + meta */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full text-white ${matchColor(act.matchScore)}`}>
                  {act.matchScore}% match
                </span>
                {act.googleRating > 0 && <StarRating rating={act.googleRating} />}
                {act.schedule && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    act.schedule === 'weekday' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                  }`}>
                    {act.schedule}
                  </span>
                )}
                {act.timing && (
                  <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
                    🕐 {act.timing}
                  </span>
                )}
                {act.estimatedCost && (
                  <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
                    💰 {act.estimatedCost}
                  </span>
                )}
                {act.targetDomains.map(d => (
                  <span key={d} className={`text-xs px-2 py-0.5 rounded-full font-medium ${DOMAIN_COLORS[d] ?? 'bg-gray-100 text-gray-600'}`}>
                    {d}
                  </span>
                ))}
              </div>

              {/* Review highlight */}
              {act.reviewHighlight && (
                <p className="text-xs text-gray-400 italic mb-3">"{act.reviewHighlight}"</p>
              )}

              {/* Venue — clickable */}
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-700 truncate">{act.location.name}</p>
                  <p className="text-xs text-gray-400 truncate">{act.location.address}</p>
                  {act.location.distanceKm > 0 && (
                    <p className="text-xs text-gray-400">{act.location.distanceKm} km away</p>
                  )}
                </div>
                {act.location.address && (
                  <a
                    href={googleMapsUrl(act.location.address, act.location.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 border border-primary-200 px-3 py-1.5 rounded-lg transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    View on Maps
                  </a>
                )}
              </div>

              {act.bookingNote && (
                <p className={`mt-2 text-xs font-medium ${
                  act.bookingNote.toLowerCase().includes('error') || act.bookingNote.toLowerCase().includes('unconfirmed')
                    ? 'text-amber-600'
                    : 'text-emerald-600'
                }`}>
                  {act.bookingNote.toLowerCase().includes('error') || act.bookingNote.toLowerCase().includes('unconfirmed') ? '⚠️' : '✓'} {act.bookingNote}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Top pick reason */}
      {parsed?.topPickReason && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 mb-6">
          <p className="text-xs font-bold text-emerald-700 mb-1">⭐ Why this is the top pick</p>
          <p className="text-xs text-emerald-800">{parsed.topPickReason}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <button className="btn-secondary" onClick={onBack}>← Back</button>
        <button
          className="flex items-center gap-2 bg-gradient-to-r from-primary-600 to-indigo-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:from-primary-700 hover:to-indigo-700 transition-all shadow-sm"
          onClick={onRestart}
        >
          Start New Profile
        </button>
      </div>
    </div>
  )
}
