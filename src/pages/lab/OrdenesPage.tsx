import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getLabSession } from '../../lib/labAuth'
import LabNavBar from '../../components/LabNavBar'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Order = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Slot  = any

function formatDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export default function LabOrdenesPage() {
  const session = getLabSession()!
  const [orders,   setOrders]   = useState<Order[]>([])
  const [loading,  setLoading]  = useState(true)
  const [slots,    setSlots]    = useState<Slot[]>([])

  // Schedule modal
  const [schedOrder,  setSchedOrder]  = useState<Order | null>(null)
  const [selectedSlot,setSelectedSlot]= useState<string>('')
  const [scheduling,  setScheduling]  = useState(false)
  const [schedOk,     setSchedOk]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [toast,       setToast]       = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.rpc('get_lab_orders', { p_lab_id: session.id })
    setOrders((data as Order[]) ?? [])
    setLoading(false)
  }, [session.id])

  const fetchSlots = useCallback(async () => {
    const { data } = await supabase.rpc('get_lab_slots', { p_lab_id: session.id })
    setSlots((data as Slot[]) ?? [])
  }, [session.id])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  function openScheduleModal(order: Order) {
    setSchedOrder(order)
    setSelectedSlot('')
    setSchedOk(false)
    setError(null)
    fetchSlots()
  }

  async function handleSchedule() {
    if (!schedOrder || !selectedSlot) return
    setError(null)
    setScheduling(true)

    const slot = slots.find((s: Slot) => s.id === selectedSlot)
    const { error: err } = await supabase.rpc('schedule_lab_appointment', {
      p_diagnostic_order_id: schedOrder.id,
      p_laboratory_id:       session.id,
      p_lab_slot_id:         selectedSlot,
      p_patient_id:          schedOrder.patient_id,
      p_exam_name:           schedOrder.exam_type,
    })

    if (err) { setError('Error al agendar. Intenta de nuevo.'); setScheduling(false); return }

    // Notify patient
    if (schedOrder.patient_email) {
      supabase.functions.invoke('send-email', {
        body: {
          to:      schedOrder.patient_email,
          subject: '📅 Tu examen ha sido agendado — Contigo',
          html: `
            <p>Hola ${schedOrder.patient_name},</p>
            <p>Tu examen ha sido agendado exitosamente.</p>
            <br/>
            <p>🔬 <strong>Examen:</strong> ${schedOrder.exam_type}</p>
            <p>🏥 <strong>Centro:</strong> ${session.name}</p>
            <p>📍 <strong>Dirección:</strong> ${session.address ?? '—'}</p>
            <p>📅 <strong>Fecha:</strong> ${slot ? formatDate(slot.date) : '—'}</p>
            <p>⏰ <strong>Hora:</strong> ${slot ? slot.start_time?.slice(0, 5) : '—'}</p>
            <p>📞 <strong>Teléfono del centro:</strong> ${session.phone ?? '—'}</p>
            <br/>
            <p>Recuerda llegar 10 minutos antes de tu cita.</p>
            <p>El equipo de Contigo</p>
          `,
        },
      }).catch(() => {})
    }

    setSchedOk(true)
    setScheduling(false)
    await fetchOrders()
    setToast('✅ Cita agendada. El paciente fue notificado.')
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <LabNavBar />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-lg">
          {toast}
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Órdenes pendientes de agendar</h1>
          <p className="text-slate-500 text-sm mt-1">Pacientes con órdenes médicas que coinciden con tus servicios.</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-7 h-7 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-3xl mb-3">🎉</p>
              <p className="text-slate-600 font-medium">No hay órdenes pendientes</p>
              <p className="text-slate-400 text-sm mt-1">Todas las órdenes han sido agendadas.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Paciente', 'Examen', 'Doctor', 'Fecha orden', 'Ciudad', 'Teléfono', ''].map((h) => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order: Order) => (
                    <tr key={order.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">{order.patient_name ?? '—'}</td>
                      <td className="py-3.5 px-4 text-slate-700">{order.exam_type}</td>
                      <td className="py-3.5 px-4 text-slate-500">{order.doctor_name ?? '—'}</td>
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">{formatDate(order.created_at?.slice(0, 10))}</td>
                      <td className="py-3.5 px-4 text-slate-500">{order.patient_city ?? '—'}</td>
                      <td className="py-3.5 px-4 text-slate-500">{order.patient_phone ?? '—'}</td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => openScheduleModal(order)}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                        >
                          Agendar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Schedule modal */}
      {schedOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSchedOrder(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-7 space-y-5"
            style={{ animation: 'modal-in 0.2s ease-out' }}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Agendar cita</h2>
                <p className="text-sm text-slate-500 mt-0.5">{schedOrder.patient_name} · {schedOrder.exam_type}</p>
              </div>
              <button onClick={() => setSchedOrder(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {schedOk ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
                  ✅ Cita agendada exitosamente. El paciente ha sido notificado por email.
                </div>
                <button onClick={() => setSchedOrder(null)}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">
                  Listo
                </button>
              </div>
            ) : (
              <>
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
                )}

                {slots.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                    ⚠️ No tienes horarios disponibles. Agrega horarios en tu{' '}
                    <a href="/lab/agenda" className="font-semibold underline">agenda</a> primero.
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                      Selecciona un horario
                    </label>
                    <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                      {slots.map((slot: Slot) => (
                        <button key={slot.id}
                          onClick={() => setSelectedSlot(slot.id)}
                          className={`p-3 rounded-xl border text-left text-xs font-medium transition-colors ${
                            selectedSlot === slot.id
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50'
                          }`}>
                          <div className="font-semibold">{formatDate(slot.date)}</div>
                          <div className="opacity-80 mt-0.5">{slot.start_time?.slice(0, 5)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button onClick={() => setSchedOrder(null)} disabled={scheduling}
                    className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                    Cancelar
                  </button>
                  <button onClick={handleSchedule}
                    disabled={!selectedSlot || scheduling || slots.length === 0}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                    {scheduling ? 'Agendando...' : 'Confirmar cita'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
