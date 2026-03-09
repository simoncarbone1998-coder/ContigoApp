import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import NavBar from '../../components/NavBar'
import { specialtyLabel } from '../../lib/types'
import type { Prescription } from '../../lib/types'

function formatDate(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export default function PatientPastillasPage() {
  const { profile, refreshProfile } = useAuth()
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState<string | null>(null)
  const [successMsg, setSuccessMsg]       = useState<string | null>(null)

  // Confirm delivery modal
  const [selected, setSelected]         = useState<Prescription | null>(null)
  const [address, setAddress]           = useState('')
  const [saveDefault, setSaveDefault]   = useState(false)
  const [confirming, setConfirming]     = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const fetchPrescriptions = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('prescriptions')
      .select(`
        *,
        doctor:doctor_id(id, full_name, specialty),
        appointment:appointment_id(slot:slot_id(date, start_time, end_time)),
        items:prescription_items(*)
      `)
      .eq('patient_id', profile.id)
      .order('created_at', { ascending: false })
    if (err) setError('No se pudieron cargar las recetas.')
    else setPrescriptions((data ?? []) as Prescription[])
    setLoading(false)
  }, [profile])

  useEffect(() => { fetchPrescriptions() }, [fetchPrescriptions])

  function openModal(presc: Prescription) {
    setSelected(presc)
    setAddress(profile?.delivery_address ?? '')
    setSaveDefault(false)
    setConfirmError(null)
  }

  async function handleConfirm() {
    if (!selected || !profile) return
    const trimmedAddress = address.trim()
    if (!trimmedAddress) {
      setConfirmError('Por favor ingresa una dirección de entrega.')
      return
    }
    setConfirming(true)
    setConfirmError(null)

    const { error: updErr } = await supabase
      .from('prescriptions')
      .update({
        delivery_address: trimmedAddress,
        status: 'en_camino',
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', selected.id)

    if (updErr) {
      setConfirmError('No se pudo confirmar la entrega. Intenta de nuevo.')
      setConfirming(false)
      return
    }

    if (saveDefault) {
      await supabase.from('profiles').update({ delivery_address: trimmedAddress }).eq('id', profile.id)
      await refreshProfile()
    }

    setSelected(null)
    setSuccessMsg('¡Tu pedido está en camino!')
    await fetchPrescriptions()
    setConfirming(false)
  }

  const pendientes = prescriptions.filter((p) => p.status === 'pendiente')
  const enCamino   = prescriptions.filter((p) => p.status === 'en_camino')

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mis Pastillas</h1>
          <p className="text-slate-500 text-sm mt-1">Recetas médicas y envío de medicamentos.</p>
        </div>

        {successMsg && (
          <div className="flex gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800"
            style={{ animation: 'modal-in 0.2s ease-out' }}>
            <svg className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-semibold">{successMsg}</p>
              <p className="text-emerald-700 mt-0.5">Tu pedido fue confirmado y está en camino a tu dirección.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Pendientes ── */}
            <section className="space-y-3">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Pendientes de confirmar
              </h2>
              {pendientes.length === 0 ? (
                <EmptyState
                  icon={<PillIcon />}
                  text="No tienes recetas pendientes"
                  sub="Cuando tu médico te recete medicamentos aparecerán aquí."
                />
              ) : (
                <div className="space-y-4">
                  {pendientes.map((p) => (
                    <PrescriptionCard
                      key={p.id}
                      prescription={p}
                      onConfirm={() => openModal(p)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* ── En camino ── */}
            <section className="space-y-3">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                En camino
              </h2>
              {enCamino.length === 0 ? (
                <EmptyState
                  icon={<TruckIcon />}
                  text="No tienes pedidos en camino"
                  sub="Las recetas confirmadas aparecerán aquí."
                />
              ) : (
                <div className="space-y-4">
                  {enCamino.map((p) => (
                    <PrescriptionCard key={p.id} prescription={p} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* ── Confirm delivery modal ── */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          style={{ animation: 'backdrop-in 0.15s ease-out' }}
          onClick={(e) => { if (e.target === e.currentTarget && !confirming) setSelected(null) }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-7"
            style={{ animation: 'modal-in 0.2s ease-out' }}
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Confirmar dirección de entrega</h2>
                <p className="text-sm text-slate-500 mt-0.5">Dr(a). {selected.doctor?.full_name ?? '—'}</p>
              </div>
              <button
                onClick={() => setSelected(null)} disabled={confirming}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center disabled:opacity-50"
                aria-label="Cerrar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Medication summary */}
            <div className="mb-5 p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Medicamentos</p>
              {(selected.items ?? []).map((item, i) => (
                <p key={i} className="text-sm text-slate-700">
                  <span className="font-semibold">{item.medicine_name}</span>
                  <span className="text-slate-500"> — {item.dose}</span>
                </p>
              ))}
            </div>

            {confirmError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {confirmError}
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="deliveryAddr" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Dirección de entrega
              </label>
              <textarea
                id="deliveryAddr"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                placeholder="Calle 123 # 45-67, Barrio, Ciudad..."
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors resize-none"
              />
            </div>

            <label className="flex items-center gap-2.5 mb-6 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveDefault}
                onChange={(e) => setSaveDefault(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 accent-blue-600"
              />
              <span className="text-sm text-slate-700">Guardar como mi dirección por defecto</span>
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => setSelected(null)} disabled={confirming}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm} disabled={confirming}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm shadow-blue-100"
              >
                {confirming ? 'Confirmando...' : 'Confirmar entrega'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PrescriptionCard({
  prescription,
  onConfirm,
}: {
  prescription: Prescription
  onConfirm?: () => void
}) {
  const slot        = prescription.appointment?.slot
  const isPendiente = prescription.status === 'pendiente'

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">
            Dr(a). {prescription.doctor?.full_name ?? '—'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {specialtyLabel(prescription.doctor?.specialty)}
            {slot ? ` · ${formatDate(slot.date)}` : ''}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${
          isPendiente
            ? 'bg-orange-50 text-orange-700 border-orange-200'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
        }`}>
          {isPendiente ? 'Pendiente' : 'En camino'}
        </span>
      </div>

      {/* Medications */}
      <div className="space-y-2">
        {(prescription.items ?? []).map((item, i) => (
          <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="text-sm font-semibold text-slate-800">{item.medicine_name}</span>
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">
                {item.dose}
              </span>
            </div>
            {!isPendiente && (
              <p className="text-xs text-slate-500">{item.instructions}</p>
            )}
          </div>
        ))}
      </div>

      {/* Delivery info (en_camino only) */}
      {!isPendiente && prescription.delivery_address && (
        <div className="pt-3 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
            Dirección de entrega
          </p>
          <p className="text-sm text-slate-700">{prescription.delivery_address}</p>
          {prescription.confirmed_at && (
            <p className="text-xs text-slate-400 mt-1">
              Confirmado el{' '}
              {new Date(prescription.confirmed_at).toLocaleDateString('es-CO', {
                day: '2-digit', month: 'short', year: 'numeric',
              })}
            </p>
          )}
        </div>
      )}

      {/* Confirm button (pendiente only) */}
      {isPendiente && onConfirm && (
        <button
          onClick={onConfirm}
          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm shadow-blue-100"
        >
          Confirmar dirección de entrega
        </button>
      )}
    </div>
  )
}

function EmptyState({ icon, text, sub }: { icon: React.ReactNode; text: string; sub: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400">
        {icon}
      </div>
      <p className="text-slate-700 font-semibold text-sm">{text}</p>
      <p className="text-slate-400 text-xs mt-1">{sub}</p>
    </div>
  )
}

function PillIcon() {
  return (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 3H6a3 3 0 00-3 3v2a3 3 0 003 3h3m0-8h3a3 3 0 013 3v2a3 3 0 01-3 3H9m0-8v8m0 0H6a3 3 0 00-3 3v2a3 3 0 003 3h3m0-8h3a3 3 0 013 3v2a3 3 0 01-3 3H9" />
    </svg>
  )
}

function TruckIcon() {
  return (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM1 1h4l2.68 13.39a2 2 0 001.97 1.61H17a2 2 0 001.95-1.56L21 8H6" />
    </svg>
  )
}
