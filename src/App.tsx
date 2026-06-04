import React, { useState } from 'react'
import ProgressBar from './components/ProgressBar'
import SmartStart, { SmartStartData } from './components/SmartStart'
import SwipeBaseline, { SwipeQuestion, SwipeProgress, defaultSwipeProgress } from './components/SwipeBaseline'
import HistoryHub, { HistoryHubData } from './components/HistoryHub'
import ConflictEngine, { ConflictEngineData } from './components/ConflictEngine'
import GrowthDashboard from './components/GrowthDashboard'

// ─── Screen map ──────────────────────────────────────────────────────────────
// screen 1 = Step 1a : Child profile form       → progress step 1, sub 1
// screen 2 = Step 1b : Swipe questions           → progress step 1, sub 2
// screen 3 = Step 2  : Progress report upload    → progress step 2
// screen 4 = Step 3  : Conflict resolution       → progress step 3
// screen 5 = Step 4  : Local activities          → progress step 4
type Screen = 1 | 2 | 3 | 4 | 5

function screenToProgressStep(s: Screen): number {
  if (s <= 2) return 1
  if (s === 3) return 2
  if (s === 4) return 3
  return 4
}
function screenToSubStep(s: Screen): number | undefined {
  if (s === 1) return 1
  if (s === 2) return 2
  return undefined
}
// Map a clicked progress step → the first screen for that step
function progressStepToScreen(p: number): Screen {
  if (p === 1) return 1
  if (p === 2) return 3
  if (p === 3) return 4
  return 5
}

// ─── Default state ────────────────────────────────────────────────────────────
const defaultProfile:  SmartStartData    = { childName: '', age: '', location: '' }
const defaultHistory:  HistoryHubData    = { reportFile: null, reportFileName: '', reportAnalysis: null }
const defaultConflict: ConflictEngineData = { conflicts: [], overallAlignment: '', synthesisNote: '', additionalNotes: '' }

// ─── Question parser ──────────────────────────────────────────────────────────
function flattenQuestions(raw: unknown): unknown[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    const first = raw[0]
    if (first && typeof first === 'object') {
      const f = first as Record<string, unknown>
      if (f.question_text || f.question || f.text) return raw
      for (const key of Object.keys(f)) {
        const nested = flattenQuestions(f[key])
        if (nested.length > 0) return nested
      }
    }
    return raw
  }
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>
    for (const key of ['questions', 'data', 'output', 'result']) {
      if (obj[key]) {
        const nested = flattenQuestions(obj[key])
        if (nested.length > 0) return nested
      }
    }
    for (const key of Object.keys(obj)) {
      const nested = flattenQuestions(obj[key])
      if (nested.length > 0) return nested
    }
  }
  return []
}
function parseQuestions(raw: unknown): SwipeQuestion[] {
  const arr = flattenQuestions(raw)
  return (arr as { id?: number; question_text?: string; question?: string; text?: string; category?: string }[])
    .filter(q => q?.question_text || q?.question || q?.text)
    .map((q, i) => ({
      id: typeof q.id === 'number' ? q.id : i,
      text: q.question_text ?? q.question ?? q.text ?? '',
      category: q.category ?? 'General',
    }))
}
function profileKey(d: SmartStartData) { return `${d.childName}|${d.age}|${d.location}` }

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>(1)
  const [maxReachedScreen, setMaxReachedScreen] = useState<Screen>(1)

  const goToScreen = (s: Screen) => {
    setScreen(s)
    setMaxReachedScreen(prev => (s > prev ? s : prev))
  }

  // Step 1a
  const [profile, setProfile]             = useState<SmartStartData>(defaultProfile)
  const [step1Submitting, setStep1Submitting] = useState(false)
  const [step1Error, setStep1Error]       = useState<string | null>(null)

  // Step 1b
  const [swipeQuestions, setSwipeQuestions] = useState<SwipeQuestion[]>([])
  const [questionsFor, setQuestionsFor]   = useState('')
  const [swipeProgress, setSwipeProgress] = useState<SwipeProgress>(defaultSwipeProgress)
  const [swipeSubmitting, setSwipeSubmitting] = useState(false)
  const [swipeError, setSwipeError]       = useState<string | null>(null)
  const [childProfile, setChildProfile]   = useState<unknown>(null) // preserved response from parent_child_profile webhook

  // Step 2
  const [history, setHistory]             = useState<HistoryHubData>(defaultHistory)
  const [step2Submitting, setStep2Submitting] = useState(false)
  const [step2Error, setStep2Error]       = useState<string | null>(null)
  const [conflictResolutionRaw, setConflictResolutionRaw] = useState<string | null>(null)

  // Step 3
  const [conflict, setConflict]             = useState<ConflictEngineData>(defaultConflict)
  const [step3Submitting, setStep3Submitting] = useState(false)
  const [step3Error, setStep3Error]         = useState<string | null>(null)
  const [activitiesRaw, setActivitiesRaw]   = useState<unknown>(null)

  const restart = () => {
    goToScreen(1)
    setMaxReachedScreen(1)
    setProfile(defaultProfile)
    setStep1Error(null)
    setSwipeQuestions([])
    setQuestionsFor('')
    setSwipeProgress(defaultSwipeProgress)
    setSwipeError(null)
    setChildProfile(null)
    setHistory(defaultHistory)
    setStep2Error(null)
    setConflictResolutionRaw(null)
    setConflict(defaultConflict)
    setStep3Error(null)
    setActivitiesRaw(null)
  }

  // ── Screen 1 → 2 ──────────────────────────────────────────────────────────
  const handleProfileNext = async (data: SmartStartData) => {
    setProfile(data)
    setStep1Error(null)
    const key = profileKey(data)
    if (key === questionsFor && swipeQuestions.length > 0) {
      goToScreen(2); return
    }
    setStep1Submitting(true)
    try {
      const res = await fetch('https://nancy879.app.n8n.cloud/webhook/generate-swipe-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json().catch(() => null)
      const questions = parseQuestions(json)
      setSwipeQuestions(questions)
      setQuestionsFor(key)
      if (key !== questionsFor) setSwipeProgress(defaultSwipeProgress)
      goToScreen(2)
    } catch {
      setStep1Error('Could not reach the server. Please try again.')
    } finally {
      setStep1Submitting(false)
    }
  }

  // ── Screen 3 → 4 (Progress Report continue) ───────────────────────────────
  const handleHistoryNext = async (data: HistoryHubData) => {
    setHistory(data)
    setStep2Error(null)
    setStep2Submitting(true)
    try {
      const res = await fetch('https://nancy879.app.n8n.cloud/webhook/conflict-resolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childName: profile.childName,
          age: profile.age,
          location: profile.location,
          childProfile,
          reportAnalysis: data.reportAnalysis,
        }),
      })
      const rawText = await res.text()
      setConflictResolutionRaw(rawText)
    } catch {
      console.warn('conflict-resolution webhook failed')
    } finally {
      setStep2Submitting(false)
    }
    goToScreen(4)
  }

  // ── Screen 4 → 5 (Conflict resolved → Find Activities) ──────────────────
  const handleConflictNext = async (data: ConflictEngineData) => {
    setConflict(data)
    setStep3Error(null)
    setStep3Submitting(true)
    try {
      const res = await fetch('https://nancy879.app.n8n.cloud/webhook/find-activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          child: { name: profile.childName, age: profile.age, location: profile.location },
          childProfile,
          reportAnalysis: history.reportAnalysis,
          conflictResolutions: data.conflicts.map(c => ({
            domain:            c.domain,
            parentPerspective: c.parentPerspective,
            schoolPerspective: c.schoolPerspective,
            chosenResolution:  c.chosenResolution,
            note:              c.note,
          })),
          overallAlignment: data.overallAlignment,
          synthesisNote:    data.synthesisNote,
        }),
      })
      const rawText = await res.text()
      console.log('[find-activities] raw response:', rawText)
      let json = null
      try { json = JSON.parse(rawText) } catch { json = rawText }
      console.log('[find-activities] parsed:', json)
      setActivitiesRaw(json)
    } catch {
      console.warn('find-activities webhook failed')
      setStep3Error('Could not fetch activities. You can still continue.')
    } finally {
      setStep3Submitting(false)
    }
    goToScreen(5)
  }

  // ── Screen 2 → 3 ──────────────────────────────────────────────────────────
  const handleSwipeNext = async () => {
    setSwipeSubmitting(true)
    setSwipeError(null)
    try {
      const res = await fetch('https://nancy879.app.n8n.cloud/webhook/parent_child_profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childName: profile.childName,
          age: profile.age,
          location: profile.location,
          swipeAnswers: swipeProgress.answers,
        }),
      })
      const profileResponse = await res.json().catch(() => null)
      setChildProfile(profileResponse)
      goToScreen(3)
    } catch {
      setSwipeError('Could not reach the server. Please try again.')
    } finally {
      setSwipeSubmitting(false)
    }
  }

  // ── Progress bar step click ────────────────────────────────────────────────
  const handleStepClick = (progressStep: number) => {
    const target = progressStepToScreen(progressStep) as Screen
    if (target <= maxReachedScreen) goToScreen(target)
  }

  const maxReachedProgressStep = screenToProgressStep(maxReachedScreen)

  return (
    <div className="min-h-screen flex flex-col items-center justify-start py-10 px-4">
      <header className="w-full max-w-2xl mb-8 flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md shadow-primary-200">
          🌱
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-none">NurtureOS</h1>
          <p className="text-xs text-gray-500 mt-0.5">Growth Partner Platform</p>
        </div>
        <div className="ml-auto text-xs text-gray-400 font-medium hidden sm:block">
          Personalised Development Plans
        </div>
      </header>

      <main className="w-full max-w-2xl bg-white rounded-3xl shadow-xl shadow-primary-100/40 border border-gray-100 p-8">
        <ProgressBar
          currentStep={screenToProgressStep(screen)}
          subStep={screenToSubStep(screen)}
          maxReachedStep={maxReachedProgressStep}
          onStepClick={handleStepClick}
        />

        {screen === 1 && (
          <SmartStart
            data={profile}
            onNext={handleProfileNext}
            submitting={step1Submitting}
            error={step1Error}
          />
        )}

        {screen === 2 && (
          <SwipeBaseline
            questions={swipeQuestions}
            childName={profile.childName}
            age={profile.age}
            location={profile.location}
            progress={swipeProgress}
            onProgressChange={setSwipeProgress}
            submitting={swipeSubmitting}
            webhookError={swipeError}
            onNext={handleSwipeNext}
            onBack={() => goToScreen(1)}
          />
        )}

        {screen === 3 && (
          <HistoryHub
            data={history}
            childName={profile.childName}
            age={profile.age}
            location={profile.location}
            submitting={step2Submitting}
            error={step2Error}
            onNext={handleHistoryNext}
            onBack={() => goToScreen(2)}
          />
        )}

        {screen === 4 && (
          <ConflictEngine
            data={conflict}
            childName={profile.childName}
            age={profile.age}
            location={profile.location}
            swipeAnswers={swipeProgress.answers}
            reportAnalysis={history.reportAnalysis}
            childProfile={childProfile}
            conflictResolutionRaw={conflictResolutionRaw}
            submitting={step3Submitting}
            error={step3Error}
            onNext={handleConflictNext}
            onBack={() => goToScreen(3)}
          />
        )}

        {screen === 5 && (
          <GrowthDashboard
            childName={profile.childName}
            age={profile.age}
            location={profile.location}
            activitiesRaw={activitiesRaw}
            onBack={() => goToScreen(4)}
            onRestart={restart}
          />
        )}
      </main>

      <footer className="mt-8 text-xs text-gray-400 text-center">
        NurtureOS · Growth Partner Platform · Powered by RAG Activity Intelligence
      </footer>
    </div>
  )
}
