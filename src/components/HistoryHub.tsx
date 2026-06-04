import React, { useState, useRef } from 'react'

export interface HistoryHubData {
  reportFile: File | null
  reportFileName: string
  reportAnalysis: ReportAnalysis | null
}

export interface ReportAnalysis {
  child_id: string
  missing_streams: string[]
  holistic_summary: string
  archetype: string
  domain_highlights: {
    academic: string
    social: string
    behavioral: string
  }
  cross_domain_intersections: {
    domains_involved: string[]
    observation: string
    implication: string
  }[]
  unified_strengths: string[]
  unified_growth_opportunities: string[]
  priority_support_actions: {
    area: string
    action: string
    rationale: string
  }[]
  age_benchmark_summary: string
}

interface HistoryHubProps {
  data: HistoryHubData
  childName: string
  age: string
  location: string
  submitting?: boolean
  error?: string | null
  onNext: (data: HistoryHubData) => void
  onBack: () => void
}

const ACCEPTED = ['application/pdf']
const WEBHOOK_URL = 'https://nancy879.app.n8n.cloud/webhook/analyze-report'

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function parseAnalysis(json: unknown): ReportAnalysis | null {
  try {
    const unwrap = (v: unknown): unknown => {
      if (!v) return null

      // Array → try each item
      if (Array.isArray(v)) {
        for (const item of v) { const r = unwrap(item); if (r) return r }
        return null
      }

      // String → extract JSON from code fences or parse directly
      if (typeof v === 'string') {
        const trimmed = v.trim()
        if (!trimmed) return null
        // Try extracting from code fences first (handles prose + ```json {...} ```)
        const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/)
        if (fenceMatch) {
          try { return unwrap(JSON.parse(fenceMatch[1])) } catch { /* fall through */ }
        }
        try { return unwrap(JSON.parse(trimmed)) } catch { return null }
      }

      if (typeof v !== 'object') return null
      const o = v as Record<string, unknown>

      // Already the synthesis payload
      if (o.holistic_summary) return o

      // Nested under school_report_synthesis key
      if (o.school_report_synthesis) return unwrap(o.school_report_synthesis)

      // n8n wraps in output (object or string)
      if (o.output !== undefined) { const r = unwrap(o.output); if (r) return r }

      // n8n LLM node wraps in text
      if (o.text !== undefined) { const r = unwrap(o.text); if (r) return r }

      // Other common wrappers
      for (const key of ['data', 'result', 'content', 'response', 'synthesis']) {
        if (o[key]) { const r = unwrap(o[key]); if (r) return r }
      }

      return null
    }

    const payload = unwrap(json) as Record<string, unknown> | null
    if (!payload?.holistic_summary) return null
    return payload as unknown as ReportAnalysis
  } catch { return null }
}

const DOMAIN_CONFIG = [
  { key: 'academic',  label: 'Academic',  emoji: '📚', bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700' },
  { key: 'social',    label: 'Social',    emoji: '🤝', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700' },
  { key: 'behavioral',label: 'Behavioral',emoji: '⚡', bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700' },
]

const DOMAIN_COLORS: Record<string, string> = {
  Academic:  'bg-blue-100 text-blue-700',
  Social:    'bg-purple-100 text-purple-700',
  Behavioral:'bg-amber-100 text-amber-700',
}

export default function HistoryHub({ data, childName, age, location, submitting = false, error = null, onNext, onBack }: HistoryHubProps) {
  const [reportFile, setReportFile]     = useState<File | null>(data.reportFile)
  const [reportFileName, setReportFileName] = useState(data.reportFileName)
  const [analysis, setAnalysis]         = useState<ReportAnalysis | null>(data.reportAnalysis)
  const [analysing, setAnalysing]       = useState(false)
  const [analyseError, setAnalyseError] = useState<string | null>(null)
  const [dragOver, setDragOver]         = useState(false)
  const [uploadError, setUploadError]   = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const callWebhook = async (file: File, attempt = 1) => {
    setAnalysing(true)
    setAnalyseError(null)
    if (attempt === 1) setAnalysis(null)
    try {
      const form = new FormData()
      form.append('report', file)
      form.append('childName', childName)
      form.append('age', age)
      form.append('location', location)
      const res = await fetch(WEBHOOK_URL, { method: 'POST', body: form })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const json = await res.json().catch(() => null)
      const parsed = parseAnalysis(json)
      if (parsed) {
        setAnalysis(parsed)
      } else if (attempt < 3) {
        // Auto-retry up to 3 times on parse failure
        setAnalyseError(`Parsing attempt ${attempt} failed — retrying…`)
        setTimeout(() => callWebhook(file, attempt + 1), 1500)
        return
      } else {
        setAnalyseError('Could not parse report analysis after 3 attempts. You can still continue.')
      }
    } catch (err) {
      if (attempt < 3) {
        setAnalyseError(`Attempt ${attempt} failed — retrying…`)
        setTimeout(() => callWebhook(file, attempt + 1), 1500)
        return
      }
      setAnalyseError('Analysis failed after 3 attempts. You can still continue.')
      console.error(err)
    } finally {
      setAnalysing(false)
    }
  }

  const processFile = (file: File) => {
    if (!ACCEPTED.includes(file.type)) { setUploadError('Please upload a PDF file.'); return }
    if (file.size > 10 * 1024 * 1024) { setUploadError('File too large. Maximum 10 MB.'); return }
    setUploadError(null)
    setReportFile(file)
    setReportFileName(file.name)
    callWebhook(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) processFile(file); e.target.value = ''
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files?.[0]; if (file) processFile(file)
  }
  const removeFile = () => {
    setReportFile(null); setReportFileName(''); setAnalysis(null)
    setAnalyseError(null); setUploadError(null)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          <span>◈</span> Step 2 of 4
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Progress Report</h2>
        <p className="text-gray-500 text-sm">
          Upload {childName || 'your child'}'s latest report card — our AI will extract key insights automatically.
        </p>
      </div>

      {/* Upload zone */}
      {!reportFile ? (
        <div
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all
            ${dragOver ? 'border-primary-400 bg-primary-50' : 'border-gray-300 hover:border-primary-300 hover:bg-gray-50'}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center text-2xl">📄</div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">Drag & drop report card here</p>
              <p className="text-xs text-gray-400 mt-1">or <span className="text-primary-600 font-medium">browse files</span></p>
            </div>
            <p className="text-xs text-gray-400">PDF only · max 10 MB</p>
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileInput} />
        </div>
      ) : (
        <div className="border border-gray-200 rounded-2xl p-4 flex items-center gap-3 bg-gray-50">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-lg shrink-0">📄</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{reportFile.name}</p>
            <p className="text-xs text-gray-400">{formatSize(reportFile.size)}</p>
          </div>
          <button onClick={removeFile} className="text-gray-400 hover:text-red-500 transition-colors text-lg shrink-0">✕</button>
        </div>
      )}

      {uploadError && <p className="mt-2 text-xs text-red-500">{uploadError}</p>}

      {/* Spinner */}
      {analysing && (
        <div className="mt-6 rounded-2xl border border-primary-100 bg-primary-50 p-6 text-center">
          <div className="flex items-center justify-center gap-3 text-primary-600 mb-2">
            <span className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Analysing report card…</span>
          </div>
          <p className="text-xs text-gray-400">AI is reading across academic, social and behavioral dimensions.</p>
        </div>
      )}

      {/* Analyse error */}
      {analyseError && !analysing && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{analyseError}</p>
          <button className="mt-1 text-xs font-medium text-red-600 underline" onClick={() => reportFile && callWebhook(reportFile)}>Retry</button>
        </div>
      )}

      {/* ── Report Analysis ── */}
      {analysis && !analysing && (
        <div className="mt-6 space-y-5">

          {/* Archetype + summary banner */}
          <div className="rounded-2xl bg-gradient-to-r from-primary-600 to-indigo-600 text-white p-5">
            <p className="text-xs font-bold opacity-70 uppercase tracking-widest mb-1">Developmental Archetype</p>
            <p className="text-xl font-bold mb-3">✦ {analysis.archetype}</p>
            <p className="text-sm leading-relaxed opacity-90">{analysis.holistic_summary}</p>
          </div>

          {/* Domain highlights */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Domain Highlights</p>
            <div className="grid grid-cols-1 gap-3">
              {DOMAIN_CONFIG.map(d => (
                <div key={d.key} className={`rounded-xl border ${d.border} ${d.bg} p-4`}>
                  <p className={`text-xs font-bold ${d.text} mb-1.5 flex items-center gap-1.5`}>
                    <span>{d.emoji}</span> {d.label}
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {analysis.domain_highlights[d.key as keyof typeof analysis.domain_highlights]}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Strengths + Growth side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-bold text-emerald-700 mb-3 flex items-center gap-1.5">✅ Unified Strengths</p>
              <ul className="space-y-2">
                {analysis.unified_strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-1 shrink-0">•</span>
                    <span className="text-xs text-emerald-800 leading-relaxed">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <p className="text-xs font-bold text-orange-700 mb-3 flex items-center gap-1.5">📈 Growth Opportunities</p>
              <ul className="space-y-2">
                {analysis.unified_growth_opportunities.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-orange-400 mt-1 shrink-0">•</span>
                    <span className="text-xs text-orange-800 leading-relaxed">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Cross-domain intersections */}
          {analysis.cross_domain_intersections.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Cross-Domain Intersections</p>
              <div className="space-y-3">
                {analysis.cross_domain_intersections.map((item, i) => (
                  <div key={i} className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {item.domains_involved.map(d => (
                        <span key={d} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${DOMAIN_COLORS[d] ?? 'bg-gray-100 text-gray-600'}`}>
                          {d}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-indigo-800 leading-relaxed mb-2">{item.observation}</p>
                    <p className="text-xs text-indigo-600 font-medium flex items-start gap-1">
                      <span className="shrink-0">→</span> {item.implication}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Priority support actions */}
          {analysis.priority_support_actions.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Priority Support Actions</p>
              <div className="space-y-3">
                {analysis.priority_support_actions.map((item, i) => (
                  <div key={i} className="rounded-xl border border-teal-200 bg-teal-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold bg-teal-200 text-teal-800 px-2 py-0.5 rounded-full">
                        {item.area}
                      </span>
                      <span className="text-xs font-bold text-teal-700">Action {i + 1}</span>
                    </div>
                    <p className="text-sm text-teal-900 font-medium leading-relaxed mb-2">{item.action}</p>
                    <p className="text-xs text-teal-700 flex items-start gap-1">
                      <span className="shrink-0 font-bold">Why:</span> {item.rationale}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Age benchmark */}
          {analysis.age_benchmark_summary && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs font-bold text-gray-600 mb-1">📊 Age Benchmark</p>
              <p className="text-xs text-gray-600 leading-relaxed">{analysis.age_benchmark_summary}</p>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-4 text-xs text-red-500 text-center">{error}</p>}

      <div className="mt-6 flex justify-between">
        <button className="btn-secondary" onClick={onBack}>← Back</button>
        <button
          className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => onNext({ reportFile, reportFileName, reportAnalysis: analysis })}
          disabled={analysing || submitting}
        >
          {submitting ? (
            <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
          ) : analysing ? 'Analysing…' : 'Continue →'}
        </button>
      </div>
    </div>
  )
}
