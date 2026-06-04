import React from 'react'

interface ProgressBarProps {
  currentStep: number          // 1–4 (visual steps)
  subStep?: number             // step 1 sub-steps: 1 = profile, 2 = swipe
  maxReachedStep: number       // highest visual step user has reached
  onStepClick: (step: number) => void
}

const STEPS = [
  { label: 'Child Profile',    icon: '✦' },
  { label: 'Progress Report',  icon: '◈' },
  { label: 'Conflict Review',  icon: '⚡' },
  { label: 'Local Activities', icon: '🌱' },
]

export default function ProgressBar({ currentStep, subStep, maxReachedStep, onStepClick }: ProgressBarProps) {
  const total = STEPS.length

  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between relative">
        {/* Full track */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 z-0" />
        {/* Filled track */}
        <div
          className="absolute top-5 left-0 h-0.5 bg-primary-500 z-0 transition-all duration-500"
          style={{ width: `${((currentStep - 1) / (total - 1)) * 100}%` }}
        />

        {STEPS.map((step, idx) => {
          const stepNum    = idx + 1
          const isCompleted = stepNum < currentStep
          const isCurrent   = stepNum === currentStep
          const isClickable = stepNum <= maxReachedStep && !isCurrent

          return (
            <div
              key={step.label}
              className={`flex flex-col items-center z-10 flex-1 ${isClickable ? 'cursor-pointer group' : ''}`}
              onClick={() => isClickable && onStepClick(stepNum)}
              title={isClickable ? `Go to ${step.label}` : undefined}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 shadow-sm
                ${isCompleted
                  ? 'bg-primary-600 border-primary-600 text-white ' + (isClickable ? 'group-hover:bg-primary-700 group-hover:scale-105' : '')
                  : isCurrent
                  ? 'bg-white border-primary-500 text-primary-600 shadow-primary-100 shadow-md'
                  : 'bg-white border-gray-200 text-gray-400'
                }`}
              >
                {isCompleted ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : stepNum}
              </div>

              <span className={`mt-2 text-xs font-medium tracking-wide text-center leading-tight transition-colors
                ${isCurrent   ? 'text-primary-600' :
                  isCompleted ? 'text-primary-400 ' + (isClickable ? 'group-hover:text-primary-600' : '') :
                  'text-gray-400'}`}
              >
                {step.label}
              </span>

              {/* Sub-step dots for step 1 */}
              {stepNum === 1 && isCurrent && (
                <div className="flex gap-1 mt-1">
                  <span className={`w-1.5 h-1.5 rounded-full transition-all ${subStep === 1 ? 'bg-primary-500' : 'bg-primary-200'}`} />
                  <span className={`w-1.5 h-1.5 rounded-full transition-all ${subStep === 2 ? 'bg-primary-500' : 'bg-primary-200'}`} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
