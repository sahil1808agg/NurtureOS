import React, { useRef } from 'react'

export interface SwipeQuestion {
  id: number
  text: string
  category: string
}

export interface SwipeAnswer {
  id: number
  text: string
  category: string
  answer: boolean
}

export interface SwipeProgress {
  current: number
  answers: SwipeAnswer[]
  done: boolean
  dragX: number
}

export const defaultSwipeProgress: SwipeProgress = {
  current: 0,
  answers: [],
  done: false,
  dragX: 0,
}

interface SwipeBaselineProps {
  questions: SwipeQuestion[]
  childName: string
  age: string
  location: string
  progress: SwipeProgress
  onProgressChange: (p: SwipeProgress) => void
  submitting: boolean
  webhookError: string | null
  onNext: () => void
  onBack: () => void
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  // Original
  Physical:                        { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300' },
  Social:                          { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300' },
  Creative:                        { bg: 'bg-pink-100',   text: 'text-pink-700',   border: 'border-pink-300' },
  Cognitive:                       { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  Emotional:                       { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
  Logic:                           { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300' },
  Motor:                           { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  // Webhook categories
  'Social Dynamics':               { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300' },
  'Behavioral Patterns':           { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-300' },
  'Sensory/Environmental Adaptation': { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-300' },
  'Cognitive/Play Style':          { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
}
const defaultColor = { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' }
const getCategoryStyle = (cat: string) => CATEGORY_COLORS[cat] ?? defaultColor

export default function SwipeBaseline({
  questions, childName, progress, onProgressChange,
  submitting, webhookError, onNext, onBack,
}: SwipeBaselineProps) {
  const { current, answers, done, dragX } = progress
  const total = questions.length
  const q = questions[current]

  const dragStartX = useRef<number | null>(null)
  const isDragging = useRef(false)
  const swipingRef = useRef(false)

  const answer = (yes: boolean) => {
    if (swipingRef.current) return
    swipingRef.current = true

    // Show fly-off animation via dragX
    onProgressChange({ ...progress, dragX: yes ? 400 : -400 })

    setTimeout(() => {
      const newAnswers = [...answers, { id: q.id, text: q.text, category: q.category, answer: yes }]
      const next = current + 1
      onProgressChange({
        current: next < total ? next : current,
        answers: newAnswers,
        done: next >= total,
        dragX: 0,
      })
      swipingRef.current = false
    }, 300)
  }

  // Mouse drag
  const onMouseDown = (e: React.MouseEvent) => { dragStartX.current = e.clientX; isDragging.current = true }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || dragStartX.current === null) return
    onProgressChange({ ...progress, dragX: e.clientX - dragStartX.current })
  }
  const onMouseUp = () => {
    if (!isDragging.current) return
    isDragging.current = false
    dragStartX.current = null
    if (dragX > 80) answer(true)
    else if (dragX < -80) answer(false)
    else onProgressChange({ ...progress, dragX: 0 })
  }

  // Touch drag
  const onTouchStart = (e: React.TouchEvent) => { dragStartX.current = e.touches[0].clientX }
  const onTouchMove = (e: React.TouchEvent) => {
    if (dragStartX.current === null) return
    onProgressChange({ ...progress, dragX: e.touches[0].clientX - dragStartX.current })
  }
  const onTouchEnd = () => {
    dragStartX.current = null
    if (dragX > 80) answer(true)
    else if (dragX < -80) answer(false)
    else onProgressChange({ ...progress, dragX: 0 })
  }

  const cardStyle = (): React.CSSProperties => {
    const isFlying = Math.abs(dragX) >= 400
    const rotate = dragX / 18
    return {
      transform: `translateX(${dragX}px) rotate(${rotate}deg)`,
      transition: isFlying ? 'transform 0.3s ease, opacity 0.3s ease' : isDragging.current ? 'none' : 'transform 0.2s ease',
      opacity: isFlying ? 0 : 1,
    }
  }

  const yesOpacity = Math.max(0, Math.min(1, dragX / 100))
  const noOpacity  = Math.max(0, Math.min(1, -dragX / 100))

  // ── No questions fallback ──────────────────────────────────────────────────
  if (total === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">🔒</div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm the profile to begin</h3>
        <p className="text-gray-500 text-sm mb-6">
          The swipe baseline personalises questions to your child's age and location,
          so we wait until the profile is set.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50"
            onClick={onBack}
          >
            ← Back
          </button>
          <button className="btn-primary" onClick={onNext}>Skip →</button>
        </div>
      </div>
    )
  }

  // ── Completion screen ──────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🎉</div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Baseline complete!</h3>
        <p className="text-gray-500 text-sm mb-6">
          We've captured {answers.filter(a => a.answer).length} interests across {total} questions.
        </p>
        {webhookError && <p className="text-xs text-red-500 mb-4">{webhookError}</p>}
        <div className="flex gap-3 justify-center">
          <button
            className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50"
            onClick={onBack}
            disabled={submitting}
          >
            ← Back
          </button>
          <button
            className="btn-primary flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={onNext}
            disabled={submitting}
          >
            {submitting ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
            ) : 'Continue →'}
          </button>
        </div>
      </div>
    )
  }

  // ── Swipe cards ────────────────────────────────────────────────────────────
  const catStyle = getCategoryStyle(q.category)

  return (
    <div>
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 text-xs font-semibold px-3 py-1 rounded-full">
            <span>✦</span> Step 1 of 4 · Interests
          </div>
          <span className="text-xs text-gray-400">{current + 1} / {total}</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Interactive Swipe Baseline</h2>
        <p className="text-gray-500 text-sm">
          Swipe right for yes, left for no — helps us understand {childName || 'your child'}'s interests.
        </p>
      </div>

      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-6">
        <div
          className="bg-primary-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>

      <div
        className="relative flex items-center justify-center select-none"
        style={{ height: 280 }}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {current + 1 < total && (
          <div className="absolute inset-x-4 top-3 bottom-0 bg-white border border-gray-200 rounded-2xl shadow-sm scale-95 opacity-60" />
        )}

        <div
          className="absolute inset-x-0 bg-white border border-gray-200 rounded-2xl shadow-lg p-6 cursor-grab active:cursor-grabbing flex flex-col justify-between"
          style={{ ...cardStyle(), top: 0, bottom: 0 }}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="absolute top-5 left-5 bg-green-500 text-white text-sm font-bold px-3 py-1 rounded-lg border-2 border-green-600 rotate-[-12deg]" style={{ opacity: yesOpacity }}>
            YES ✓
          </div>
          <div className="absolute top-5 right-5 bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-lg border-2 border-red-600 rotate-[12deg]" style={{ opacity: noOpacity }}>
            NOPE ✗
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center px-2 gap-4">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
              {q.category}
            </span>
            <p className="text-gray-800 text-base font-medium leading-relaxed">{q.text}</p>
          </div>

          <p className="text-center text-xs text-gray-400 mt-2">← swipe or use buttons below →</p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-6 mt-6">
        <button
          onClick={() => answer(false)}
          className="w-14 h-14 rounded-full bg-white border-2 border-red-300 text-red-500 text-2xl shadow-md hover:bg-red-50 hover:border-red-400 hover:scale-110 transition-all flex items-center justify-center"
        >✗</button>
        <button
          onClick={() => answer(true)}
          className="w-14 h-14 rounded-full bg-white border-2 border-green-300 text-green-500 text-2xl shadow-md hover:bg-green-50 hover:border-green-400 hover:scale-110 transition-all flex items-center justify-center"
        >✓</button>
      </div>

      <div className="mt-6 flex justify-start">
        <button className="text-sm text-gray-400 hover:text-gray-600" onClick={onBack}>← Back</button>
      </div>
    </div>
  )
}
