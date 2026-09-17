import React, { useEffect, useState } from 'react'

interface WhatsAppCountdownToastProps {
  visible: boolean
  patientName: string
  onCancel: () => void
  onComplete: () => void
  durationSeconds?: number
}

export function WhatsAppCountdownToast({
  visible,
  patientName,
  onCancel,
  onComplete,
  durationSeconds = 5,
}: WhatsAppCountdownToastProps) {
  const [timeLeft, setTimeLeft] = useState(durationSeconds)

  useEffect(() => {
    if (!visible) {
      setTimeLeft(durationSeconds)
      return
    }

    if (timeLeft <= 0) {
      onComplete()
      return
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [visible, timeLeft, onComplete, durationSeconds])

  if (!visible) return null

  const progressPercentage = (timeLeft / durationSeconds) * 100

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-green-600 text-white rounded-lg shadow-lg overflow-hidden flex flex-col w-[350px] max-w-[90vw]">
        <div className="p-3 flex items-center justify-between text-sm">
          <span>
            📱 WhatsApp será enviado para <strong>{patientName}</strong> em {timeLeft}s...
          </span>
          <button
            onClick={onCancel}
            className="text-green-100 hover:text-white underline text-xs font-medium ml-3 shrink-0"
          >
            Cancelar
          </button>
        </div>
        <div className="h-1 bg-green-800 w-full">
          <div
            className="h-full bg-green-300 transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>
    </div>
  )
}
