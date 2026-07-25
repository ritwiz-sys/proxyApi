import { useEffect, useRef, useState } from 'react'

interface AlertsButtonsProps {
  onCreateAlert: () => void
  onCheckAlerts: () => void
}

const AlertsButtons = ({ onCreateAlert, onCheckAlerts }: AlertsButtonsProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="rounded-full border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
      >
        Alerts 🔔
      </button>

      {isOpen && (
        <div className="absolute right-0 z-10 mt-2 w-48 overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-xl">
          <button
            type="button"
            onClick={() => { onCheckAlerts(); setIsOpen(false) }}
            className="block w-full px-4 py-3 text-left text-sm text-slate-100 transition hover:bg-slate-700"
          >
            Check Alerts
          </button>
          <button
            type="button"
            onClick={() => { onCreateAlert(); setIsOpen(false) }}
            className="block w-full border-t border-slate-700 px-4 py-3 text-left text-sm text-slate-100 transition hover:bg-slate-700"
          >
            Create Alert
          </button>
        </div>
      )}
    </div>
  )
}

export default AlertsButtons
