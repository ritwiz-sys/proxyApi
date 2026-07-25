import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../api/axiosInstance.ts'
import AlertCard from './AlertCard.tsx'
import type { Alert } from '../../types.ts'

interface MyAlertsModalProps {
  onClose: () => void
}

const MyAlertsModal = ({ onClose }: MyAlertsModalProps) => {

  // ─── State ───────────────────────────────────────
  const [isEditMode, setIsEditMode] = useState(false)

  // ─── Fetch Alerts ────────────────────────────────
  const { data: alerts, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const res = await api.get('/api/alerts')
      return res.data as Alert[]
    }
  })

  // ─── Delete Mutation ─────────────────────────────
  const queryClient = useQueryClient()

  const deleteAlert = useMutation({
    mutationFn: (alertId: string) =>
      api.delete(`/api/alerts/${alertId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    }
  })

  // ─── Pause/Resume Mutation ───────────────────────
  const toggleAlert = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`/api/alerts/${id}`, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    }
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl max-h-[80vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-100">
            🔔 My Alerts
          </h2>
          <div className="flex items-center gap-3">
            {/* Edit toggle */}
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`text-sm px-3 py-1 rounded-lg transition ${
                isEditMode
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {isEditMode ? 'Done' : 'Edit'}
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-100 text-xl transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center text-slate-400 py-8">
            Loading alerts...
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (!alerts || alerts.length === 0) && (
          <div className="text-center text-slate-400 py-8">
            <div className="text-4xl mb-3">🔕</div>
            <p>No alerts yet</p>
            <p className="text-sm mt-1">Create one to get notified</p>
          </div>
        )}

        {/* Alerts list */}
        {alerts && alerts.length > 0 && (
          <div className="space-y-4">
            {alerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                isEditMode={isEditMode}
                onDelete={() => deleteAlert.mutate(alert.id)}
                onToggle={() => toggleAlert.mutate({
                  id: alert.id,
                  is_active: !alert.is_active
                })}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

export default MyAlertsModal