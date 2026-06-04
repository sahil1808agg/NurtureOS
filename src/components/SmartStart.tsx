import React, { useState, useRef, useEffect, useCallback } from 'react'

export interface SmartStartData {
  childName: string
  age: string
  location: string
}

interface SmartStartProps {
  data: SmartStartData
  onNext: (data: SmartStartData) => void
  submitting?: boolean
  error?: string | null
}

const GOOGLE_API_KEY = 'AIzaSyALtdvueCY2VvLtdhv8_POp5DaS8Fn6WN8'

interface Prediction {
  place_id: string
  description: string
  structured_formatting: { main_text: string; secondary_text: string }
}

export default function SmartStart({ data, onNext, submitting = false, error = null }: SmartStartProps) {
  const [childName, setChildName] = useState(data.childName)
  const [age, setAge] = useState(data.age)
  const [locationInput, setLocationInput] = useState(data.location)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [loadingPlaces, setLoadingPlaces] = useState(false)
  const [errors, setErrors] = useState<{ childName?: string; age?: string; location?: string }>({})
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync state if parent data changes (e.g. navigating back restores saved values)
  useEffect(() => {
    setChildName(data.childName)
    setAge(data.age)
    setLocationInput(data.location)
  }, [data.childName, data.age, data.location])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.trim().length < 2) { setPredictions([]); setShowDropdown(false); return }
    setLoadingPlaces(true)
    try {
      const res = await fetch(`/api/places/autocomplete/json?input=${encodeURIComponent(input)}&types=geocode&key=${GOOGLE_API_KEY}`)
      const json = await res.json()
      if (json.status === 'OK') { setPredictions(json.predictions); setShowDropdown(true) }
      else { setPredictions([]); setShowDropdown(false) }
    } catch {
      setPredictions([]); setShowDropdown(false)
    } finally {
      setLoadingPlaces(false)
    }
  }, [])

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setLocationInput(val)
    setActiveIndex(-1)
    setErrors(v => ({ ...v, location: undefined }))
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchPredictions(val), 250)
  }

  const selectPrediction = (p: Prediction) => {
    setLocationInput(p.description)
    setPredictions([])
    setShowDropdown(false)
    setActiveIndex(-1)
    setErrors(v => ({ ...v, location: undefined }))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || !predictions.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, predictions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); selectPrediction(predictions[activeIndex]) }
    else if (e.key === 'Escape') setShowDropdown(false)
  }

  const handleNext = () => {
    const errs: typeof errors = {}
    if (!childName.trim()) errs.childName = "Child's name is required"
    if (!age || isNaN(Number(age)) || Number(age) < 1 || Number(age) > 18) errs.age = 'Please enter a valid age (1–18)'
    if (!locationInput.trim()) errs.location = 'Location is required'
    if (Object.keys(errs).length) { setErrors(errs); return }
    onNext({ childName, age, location: locationInput })
  }

  return (
    <div>
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          <span>✦</span> Step 1 of 4 · Profile
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Smart-Start</h2>
        <p className="text-gray-500 text-sm">Tell us about your child so we can personalise their growth journey.</p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="label">Child's Name</label>
          <input
            className={`input-field ${errors.childName ? 'border-red-400 focus:ring-red-300' : ''}`}
            type="text" placeholder="e.g. Reyansh" value={childName}
            onChange={e => { setChildName(e.target.value); setErrors(v => ({ ...v, childName: undefined })) }}
          />
          {errors.childName && <p className="mt-1 text-xs text-red-500">{errors.childName}</p>}
        </div>

        <div>
          <label className="label">Age (years)</label>
          <input
            className={`input-field ${errors.age ? 'border-red-400 focus:ring-red-300' : ''}`}
            type="number" min={1} max={18} placeholder="e.g. 5" value={age}
            onChange={e => { setAge(e.target.value); setErrors(v => ({ ...v, age: undefined })) }}
          />
          {errors.age && <p className="mt-1 text-xs text-red-500">{errors.age}</p>}
        </div>

        <div ref={wrapperRef} className="relative">
          <label className="label">Location</label>
          <div className="relative">
            <input
              className={`input-field ${errors.location ? 'border-red-400 focus:ring-red-300' : ''}`}
              type="text" placeholder="Type a neighbourhood, city or area…"
              value={locationInput} onChange={handleLocationChange}
              onKeyDown={handleKeyDown} autoComplete="off"
            />
            {loadingPlaces && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          {errors.location && <p className="mt-1 text-xs text-red-500">{errors.location}</p>}

          {showDropdown && predictions.length > 0 && (
            <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
              {predictions.map((p, i) => (
                <li
                  key={p.place_id}
                  className={`px-4 py-3 cursor-pointer flex items-start gap-2 text-sm transition-colors ${i === activeIndex ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                  onMouseDown={e => { e.preventDefault(); selectPrediction(p) }}
                >
                  <span className="text-primary-400 mt-0.5 shrink-0">📍</span>
                  <div>
                    <p className={`font-medium ${i === activeIndex ? 'text-primary-700' : 'text-gray-800'}`}>{p.structured_formatting.main_text}</p>
                    <p className="text-xs text-gray-400">{p.structured_formatting.secondary_text}</p>
                  </div>
                </li>
              ))}
              <li className="px-4 py-2 border-t border-gray-100 flex justify-end">
                <img src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3_hdpi.png" alt="Powered by Google" className="h-4" />
              </li>
            </ul>
          )}
        </div>
      </div>

      {error && <p className="mt-4 text-xs text-red-500 text-center">{error}</p>}

      <div className="mt-6 flex justify-end">
        <button
          className="btn-primary flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={handleNext}
          disabled={submitting}
        >
          {submitting
            ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Processing…</>
            : 'Continue →'}
        </button>
      </div>
    </div>
  )
}
