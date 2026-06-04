import React, { useState, useEffect } from 'react'
import { SwipeAnswer } from './SwipeBaseline'
import { ReportAnalysis } from './HistoryHub'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ResolutionOption {
  key: string
  label: string
  rationale: string
}

export interface Conflict {
  conflictId: string
  type: string
  domain: string
  severity: 'mild' | 'moderate' | 'significant'
  parentPerspective: string
  schoolPerspective: string
  likelyCause: string
  resolutionOptions: ResolutionOption[]
  chosenResolution: string | null
  note: string
}

export interface ConflictEngineData {
  conflicts: Conflict[]
  overallAlignment: string
  synthesisNote: string
  additionalNotes: string
}

interface ConflictEngineProps {
  data: ConflictEngineData
  childName: string
  age: string
  location: string
  swipeAnswers: SwipeAnswer[]
  reportAnalysis: ReportAnalysis | null
  childProfile: unknown
  conflictResolutionRaw: string | null
  submitting?: boolean
  error?: string | null
  onNext: (data: ConflictEngineData) => void
  onBack: () => void
}

const WEBHOOK = 'https://nancy879.app.n8n.cloud/webhook/identify-conflicts'

// ─── Parse webhook response ────────────────────────────────────────────────────
function buildFromPayload(payload: Record<string, unknown>): ConflictEngineData | null {
  if (!payload?.conflicts) return null
  return {
    conflicts: (payload.conflicts as Record<string, unknown>[]).map(c => ({
      conflictId:        String(c.conflictId        ?? Math.random()),
      type:              String(c.type              ?? 'A'),
      domain:            String(c.domain            ?? 'General'),
      severity:          (c.severity as 'mild' | 'moderate' | 'significant') ?? 'moderate',
      parentPerspective: String(c.parentPerspective ?? ''),
      schoolPerspective: String(c.schoolPerspective ?? ''),
      likelyCause:       String(c.likelyCause       ?? ''),
      resolutionOptions: Array.isArray(c.resolutionOptions)
        ? (c.resolutionOptions as Record<string, string>[]).map(o => ({
            key:       String(o.key       ?? ''),
            label:     String(o.label     ?? ''),
            rationale: String(o.rationale ?? ''),
          }))
        : [],
      chosenResolution: null,
      note: '',
    })),
    overallAlignment: String(payload.overallAlignment ?? 'partial'),
    synthesisNote:    String(payload.synthesisNote    ?? ''),
    additionalNotes:  '',
  }
}

function stripFences(str: string): string {
  // Try to capture content between ``` fences first
  const match = str.match(/```(?:json)?\s*([\s\S]+?)\s*```/)
  if (match) return match[1].trim()
  // No fences — return as-is
  return str.trim()
}

function parseWebhookResponse(rawText: string): ConflictEngineData | null {
  // Try all known n8n response shapes in order
  try {
    const outer = JSON.parse(rawText)

    // Shape 1: direct object  { conflictsFound, conflicts, ... }
    if (outer && !Array.isArray(outer) && outer.conflicts) {
      return buildFromPayload(outer)
    }

    // Shape 2: array wrapper
    if (Array.isArray(outer) && outer.length > 0) {
      const first = outer[0]

      // Shape 2a: array item is the payload directly
      if (first?.conflicts) return buildFromPayload(first)

      // Shape 2b: array item has a `text` field (n8n AI node)
      if (typeof first?.text === 'string') {
        const stripped = stripFences(first.text)
        try {
          const inner = JSON.parse(stripped)
          if (inner?.conflicts) return buildFromPayload(inner)
        } catch { /* fall through */ }
      }

      // Shape 2c: array item has an `output` field
      if (typeof first?.output === 'string') {
        const stripped = stripFences(first.output)
        try {
          const inner = JSON.parse(stripped)
          if (inner?.conflicts) return buildFromPayload(inner)
        } catch { /* fall through */ }
      }
      if (first?.output && typeof first.output === 'object') {
        return buildFromPayload(first.output as Record<string, unknown>)
      }
    }
  } catch { /* fall through to raw string attempt */ }

  // Last resort: rawText itself might be a JSON string with fences
  try {
    const stripped = stripFences(rawText)
    const parsed = JSON.parse(stripped)
    if (parsed?.conflicts) return buildFromPayload(parsed)
  } catch { /* give up */ }

  return null
}

// ─── Severity styles ──────────────────────────────────────────────────────────
const SEVERITY_STYLE: Record<string, string> = {
  mild:        'bg-yellow-100 text-yellow-700',
  moderate:    'bg-orange-100 text-orange-700',
  significant: 'bg-red-100 text-red-700',
}

const DOMAIN_EMOJI: Record<string, string> = {
  Social: '🤝', Cognitive: '🧠', Physical: '🏃', Behaviour: '⚡',
  Behavioral: '⚡', Creative: '🎨', Emotional: '💛', Sensory: '🌟',
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ConflictEngine({
  data, childName, conflictResolutionRaw, submitting = false, error: externalError = null, onNext, onBack,
}: ConflictEngineProps) {
  const [state, setState] = useState<ConflictEngineData>(data)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Parse the conflict-resolution webhook response on mount
  useEffect(() => {
    if (state.conflicts.length > 0) return   // already loaded (back navigation)

    if (!conflictResolutionRaw) {
      setError('No conflict analysis available. Please go back and upload a report first.')
      return
    }

    setLoading(true)
    try {
      const parsed = parseWebhookResponse(conflictResolutionRaw)
      if (parsed && parsed.conflicts.length > 0) {
        setState(parsed)
      } else {
        setState(s => ({ ...s, synthesisNote: parsed?.synthesisNote ?? '', overallAlignment: 'strong' }))
      }
    } catch (err) {
      console.error('[ConflictEngine] parse error:', err)
      setError('Could not parse conflict analysis.')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setResolution = (conflictId: string, key: string) => {
    setState(s => ({
      ...s,
      conflicts: s.conflicts.map(c =>
        c.conflictId === conflictId ? { ...c, chosenResolution: key } : c
      ),
    }))
  }

  const setNote = (conflictId: string, note: string) => {
    setState(s => ({
      ...s,
      conflicts: s.conflicts.map(c =>
        c.conflictId === conflictId ? { ...c, note } : c
      ),
    }))
  }

  const allResolved = state.conflicts.length === 0 || state.conflicts.every(c => c.chosenResolution !== null)

  const RESOLUTION_COLORS: Record<string, string> = {
    trust_school:      'border-blue-400 bg-blue-50 text-blue-800',
    trust_parent:      'border-purple-400 bg-purple-50 text-purple-800',
    context_dependent: 'border-teal-400 bg-teal-50 text-teal-800',
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          <span>⚡</span> Step 3 of 4
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Conflict Review</h2>
        <p className="text-gray-500 text-sm">
          Comparing your observations about {childName || 'your child'} with the school report.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-2xl border border-primary-100 bg-primary-50 p-8 text-center">
          <div className="flex items-center justify-center gap-3 text-primary-600 mb-2">
            <span className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Analysing conflicts…</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Comparing parent profile with school report using AI.</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* No conflicts */}
      {!loading && !error && state.conflicts.length === 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center mb-6">
          <div className="text-3xl mb-2">🎉</div>
          <p className="font-semibold text-emerald-800">No conflicts detected!</p>
          <p className="text-xs text-emerald-600 mt-1">
            Your observations align well with {childName || 'your child'}'s school report.
          </p>
        </div>
      )}

      {/* Synthesis note */}
      {!loading && state.synthesisNote && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 mb-5">
          <p className="text-xs font-bold text-indigo-700 mb-1">🔍 Overall Assessment</p>
          <p className="text-xs text-indigo-800 leading-relaxed">{state.synthesisNote}</p>
        </div>
      )}

      {/* Conflict cards */}
      {!loading && state.conflicts.map((conflict, idx) => (
        <div key={conflict.conflictId} className="mb-5 rounded-2xl border border-gray-200 overflow-hidden shadow-sm">

          {/* Card header */}
          <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-gray-200">
            <span className="text-xl">{DOMAIN_EMOJI[conflict.domain] ?? '⚡'}</span>
            <span className="font-bold text-gray-800 text-sm">{conflict.domain}</span>
            <span className={`ml-1 text-xs font-semibold px-2 py-0.5 rounded-full ${SEVERITY_STYLE[conflict.severity] ?? SEVERITY_STYLE.moderate}`}>
              {conflict.severity}
            </span>
            <span className="ml-auto text-xs font-medium text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
              Conflict {idx + 1}
            </span>
          </div>

          <div className="p-5 space-y-4">

            {/* Perspectives */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-purple-50 border border-purple-200 p-4">
                <p className="text-xs font-bold text-purple-700 mb-2">👪 Your Observation</p>
                <p className="text-sm text-purple-900 leading-relaxed">{conflict.parentPerspective}</p>
              </div>
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                <p className="text-xs font-bold text-blue-700 mb-2">🏫 School Report</p>
                <p className="text-sm text-blue-900 leading-relaxed">{conflict.schoolPerspective}</p>
              </div>
            </div>

            {/* Likely cause */}
            {conflict.likelyCause && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                <p className="text-xs font-bold text-amber-700 mb-1">💡 Likely Reason</p>
                <p className="text-sm text-amber-800 leading-relaxed">{conflict.likelyCause}</p>
              </div>
            )}

            {/* Resolution options */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-3">How would you like to resolve this?</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {conflict.resolutionOptions.map(opt => {
                  const isChosen = conflict.chosenResolution === opt.key
                  const colorClass = RESOLUTION_COLORS[opt.key] ?? 'border-gray-300 bg-gray-50 text-gray-800'
                  return (
                    <button
                      key={opt.key}
                      onClick={() => setResolution(conflict.conflictId, opt.key)}
                      className={`text-left px-4 py-3 rounded-xl border-2 transition-all
                        ${isChosen ? `${colorClass} shadow-sm` : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}
                    >
                      <p className="text-xs font-bold mb-1">{opt.label}</p>
                      <p className="text-xs leading-snug opacity-80">{opt.rationale}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Optional note */}
            <input
              type="text"
              className="input-field text-sm"
              placeholder="Add context (optional)…"
              value={conflict.note}
              onChange={e => setNote(conflict.conflictId, e.target.value)}
            />
          </div>
        </div>
      ))}

      {/* Additional notes */}
      {!loading && (
        <div className="mt-2">
          <label className="label">
            Anything else to add? <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            className="input-field resize-none"
            rows={3}
            placeholder="Any extra context about your child's behaviour at home vs school…"
            value={state.additionalNotes}
            onChange={e => setState(s => ({ ...s, additionalNotes: e.target.value }))}
          />
        </div>
      )}

      {/* Unresolved warning */}
      {!loading && state.conflicts.length > 0 && !allResolved && (
        <p className="mt-3 text-xs text-amber-600 font-medium">
          ⚠️ Please resolve all {state.conflicts.filter(c => !c.chosenResolution).length} remaining conflict(s) to continue.
        </p>
      )}

      {/* External error from find-activities call */}
      {externalError && (
        <p className="mt-3 text-xs text-red-500">{externalError}</p>
      )}

      {/* Nav */}
      <div className="mt-6 flex justify-between">
        <button className="btn-secondary" onClick={onBack} disabled={submitting}>← Back</button>
        <button
          className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => onNext(state)}
          disabled={loading || !allResolved || submitting}
        >
          {submitting ? (
            <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Finding Activities…</>
          ) : loading ? 'Loading…' : 'Find Activities →'}
        </button>
      </div>
    </div>
  )
}
