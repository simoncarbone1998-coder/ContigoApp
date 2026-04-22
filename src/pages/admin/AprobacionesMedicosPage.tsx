import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useAdminCtx } from './AdminContext'
import { specialtyLabel, SPECIALTIES } from '../../lib/types'

function initials(name: string | null, email: string | null) {
  if (name) { const p = name.trim().split(' ').filter(Boolean); return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : p[0][0].toUpperCase() }
  return (email?.[0] ?? '?').toUpperCase()
}

type DocUrls = { cedula: string | null; diploma: string | null; especializacion: string | null }

async function fetchSignedUrls(doctor: {
  cedula_url?: string | null
  diploma_pregrado_url?: string | null
  diploma_especializacion_url?: string | null
}): Promise<DocUrls> {
  async function sign(path: string | null | undefined): Promise<string | null> {
    if (!path) return null
    if (path.startsWith('http')) return path
    const { data } = await supabase.storage.from('doctor-documents').createSignedUrl(path, 3600)
    return data?.signedUrl ?? null
  }
  const [cedula, diploma, especializacion] = await Promise.all([
    sign(doctor.cedula_url),
    sign(doctor.diploma_pregrado_url),
    sign(doctor.diploma_especializacion_url),
  ])
  return { cedula, diploma, especializacion }
}

// ─── Pending doctor approval card ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PendingDoctorCard({ doctor, processingId, onApprove, onReject }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doctor: any
  processingId: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onApprove: (d: any) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onReject: (d: any) => void
}) {
  const [expanded,    setExpanded]    = useState(false)
  const [docUrls,     setDocUrls]     = useState<DocUrls | null>(null)
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [copied,      setCopied]      = useState(false)

  async function handleExpand() {
    if (!expanded && !docUrls) {
      setLoadingDocs(true)
      const urls = await fetchSignedUrls(doctor)
      setDocUrls(urls)
      setLoadingDocs(false)
    }
    setExpanded((v) => !v)
  }

  async function copyLicense() {
    if (!doctor.medical_license) return
    await navigator.clipboard.writeText(doctor.medical_license)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const docList = [
    { label: 'Cédula de ciudadanía',       url: docUrls?.cedula,         stored: doctor.cedula_url,                  naLabel: 'No subido' },
    { label: 'Diploma de pregrado',        url: docUrls?.diploma,        stored: doctor.diploma_pregrado_url,        naLabel: 'No subido' },
    { label: 'Diploma de especialización', url: docUrls?.especializacion, stored: doctor.diploma_especializacion_url, naLabel: 'No aplica' },
  ]

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <span className="text-emerald-700 text-sm font-bold">{initials(doctor.full_name, doctor.email)}</span>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-900 text-base">{doctor.full_name ?? '—'}</p>
            <p className="text-sm text-slate-500">{doctor.email}</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {doctor.specialty && (
                <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-medium">
                  {specialtyLabel(doctor.specialty)}
                </span>
              )}
              {doctor.undergraduate_university && (
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                  {doctor.undergraduate_university}
                </span>
              )}
              {doctor.medical_license && (
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono">
                  T.P. {doctor.medical_license}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:items-end gap-2 shrink-0">
          <div className="flex gap-2">
            <button onClick={() => onApprove(doctor)} disabled={processingId === doctor.id}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
              {processingId === doctor.id ? '...' : 'Aprobar'}
            </button>
            <button onClick={() => onReject(doctor)} disabled={processingId === doctor.id}
              className="px-4 py-2 rounded-xl border border-red-200 text-red-600 bg-white hover:bg-red-50 text-sm font-semibold transition-colors disabled:opacity-50">
              Rechazar
            </button>
          </div>
          <button onClick={handleExpand}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors flex items-center gap-1">
            {expanded ? 'Ocultar ▲' : 'Ver documentos y verificación ▼'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-5 space-y-5">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Documentos del médico</p>
            {loadingDocs ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className="w-3 h-3 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                Generando enlaces...
              </div>
            ) : (
              <div className="space-y-2">
                {docList.map(({ label, url, stored, naLabel }) => (
                  <div key={label} className="flex items-center justify-between gap-4 bg-white rounded-xl border border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📄</span>
                      <span className="text-sm font-medium text-slate-700">{label}</span>
                    </div>
                    {stored ? (
                      url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors font-semibold shrink-0">
                          Ver documento →
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 shrink-0">Enlace no disponible</span>
                      )
                    ) : (
                      <span className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full shrink-0">
                        {naLabel}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Verificación en RETHUS</p>
            <p className="text-xs text-slate-400 mb-3">Verifica la tarjeta profesional en el registro oficial del Ministerio de Salud.</p>
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-4 space-y-3">
              <a href="https://www.minsalud.gov.co/Paginas/rethus.aspx" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors">
                🔍 Verificar en RETHUS →
              </a>
              {doctor.medical_license && (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-slate-500">
                    Tarjeta profesional:{' '}
                    <span className="font-mono font-semibold text-slate-900">{doctor.medical_license}</span>
                  </span>
                  <button onClick={copyLicense}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors font-medium">
                    {copied ? '✅ Copiado' : '📋 Copiar número'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Change request card ────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  full_name:                'Nombre completo',
  phone:                    'Teléfono',
  specialty:                'Especialidad',
  undergraduate_university: 'Universidad de pregrado',
  medical_license:          'Tarjeta profesional',
  doctor_description:       'Descripción profesional',
  bio:                      'Bio',
}

function formatSpecialty(val: string) {
  return SPECIALTIES.find((s) => s.value === val)?.label ?? val
}

function formatFieldValue(key: string, val: string) {
  if (key === 'specialty') return formatSpecialty(val)
  return val || '—'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChangeRequestCard({ req, adminId, onProcessed }: { req: any; adminId: string; onProcessed: () => void }) {
  const [adminNote,       setAdminNote]       = useState('')
  const [processing,      setProcessing]      = useState(false)
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [newDocUrls,      setNewDocUrls]      = useState<DocUrls | null>(null)
  const [loadingDocs,     setLoadingDocs]     = useState(false)
  const [docsExpanded,    setDocsExpanded]    = useState(false)

  const changes   = (req.requested_changes ?? {}) as Record<string, string>
  const changedKeys = Object.keys(changes)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doctor    = req.doctor as any
  const hasNewDocs = !!(req.new_cedula_url || req.new_diploma_url || req.new_especializacion_url)

  async function loadNewDocUrls() {
    setLoadingDocs(true)
    const sign = async (path: string | null): Promise<string | null> => {
      if (!path) return null
      if (path.startsWith('http')) return path
      const { data } = await supabase.storage.from('doctor-documents').createSignedUrl(path, 3600)
      return data?.signedUrl ?? null
    }
    const [cedula, diploma, especializacion] = await Promise.all([
      sign(req.new_cedula_url ?? null),
      sign(req.new_diploma_url ?? null),
      sign(req.new_especializacion_url ?? null),
    ])
    setNewDocUrls({ cedula, diploma, especializacion })
    setLoadingDocs(false)
  }

  async function handleToggleDocs() {
    if (!docsExpanded && !newDocUrls) await loadNewDocUrls()
    setDocsExpanded((v) => !v)
  }

  async function handleApprove() {
    setProcessing(true)
    const now = new Date().toISOString()
    // Apply requested field changes
    if (changedKeys.length > 0) {
      const update: Record<string, string> = {}
      changedKeys.forEach((k) => { update[k] = changes[k] })
      await supabase.from('profiles').update(update).eq('id', req.doctor_id)
    }
    // Apply new document URLs
    const docUpdate: Record<string, string> = {}
    if (req.new_cedula_url)          docUpdate.cedula_url                  = req.new_cedula_url
    if (req.new_diploma_url)         docUpdate.diploma_pregrado_url        = req.new_diploma_url
    if (req.new_especializacion_url) docUpdate.diploma_especializacion_url = req.new_especializacion_url
    if (Object.keys(docUpdate).length > 0) {
      await supabase.from('profiles').update(docUpdate).eq('id', req.doctor_id)
    }
    await supabase.from('doctor_change_requests')
      .update({ status: 'approved', reviewed_at: now, reviewed_by: adminId })
      .eq('id', req.id)
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          to:      doctor.email,
          subject: '✅ Tu solicitud de cambio fue aprobada — Contigo',
          html:    `<p>Hola Dr(a). <strong>${doctor.full_name}</strong>,</p><p>Los cambios en tu perfil han sido revisados y aplicados.</p><br/><p><a href="https://contigomedicina.com/doctor/perfil" style="background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:bold;">Ver mi perfil →</a></p><br/><p>El equipo de Contigo</p>`,
        },
      })
    } catch { /* non-critical */ }
    onProcessed()
    setProcessing(false)
  }

  async function handleReject() {
    setProcessing(true)
    const now = new Date().toISOString()
    await supabase.from('doctor_change_requests')
      .update({ status: 'rejected', admin_note: adminNote.trim() || null, reviewed_at: now, reviewed_by: adminId })
      .eq('id', req.id)
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          to:      doctor.email,
          subject: 'Tu solicitud de cambio en Contigo',
          html:    `<p>Hola Dr(a). <strong>${doctor.full_name}</strong>,</p><p>Hemos revisado tu solicitud y no fue aprobada en este momento.</p>${adminNote.trim() ? `<p><strong>Nota:</strong> ${adminNote.trim()}</p>` : ''}<br/><p>Si tienes preguntas escríbenos a <a href="mailto:hola@contigomedicina.com">hola@contigomedicina.com</a></p><br/><p>El equipo de Contigo</p>`,
        },
      })
    } catch { /* non-critical */ }
    onProcessed()
    setProcessing(false)
  }

  const submittedDate = new Date(req.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
      {/* Header */}
      <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-blue-700 text-sm font-bold">{initials(doctor?.full_name, doctor?.email)}</span>
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">{doctor?.full_name ?? '—'}</p>
            <p className="text-xs text-slate-500">{doctor?.email} · {specialtyLabel(doctor?.specialty)}</p>
          </div>
        </div>
        <span className="text-xs text-slate-400">Enviado el {submittedDate}</span>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Diff table */}
        {changedKeys.length > 0 ? (
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Cambios solicitados</p>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-3 gap-0 bg-slate-50 px-4 py-2 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Campo</span>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Valor actual</span>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Valor solicitado</span>
              </div>
              {changedKeys.map((key, i) => (
                <div key={key} className={`grid grid-cols-3 gap-0 px-4 py-3 ${i < changedKeys.length - 1 ? 'border-b border-slate-100' : ''}`}>
                  <span className="text-xs font-semibold text-slate-600">{FIELD_LABELS[key] ?? key}</span>
                  <span className="text-xs text-slate-500 pr-3 break-words">{formatFieldValue(key, doctor?.[key] ?? '')}</span>
                  <span className="text-xs text-emerald-700 font-medium break-words">{formatFieldValue(key, changes[key])}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">Sin cambios de texto — solo documentos.</p>
        )}

        {/* New documents */}
        {hasNewDocs && (
          <div>
            <button type="button" onClick={handleToggleDocs}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
              {docsExpanded ? 'Ocultar documentos ▲' : 'Ver nuevos documentos ▼'}
            </button>
            {docsExpanded && (
              <div className="mt-3 space-y-2">
                {loadingDocs ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <div className="w-3 h-3 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                    Generando enlaces...
                  </div>
                ) : (
                  [
                    { label: 'Cédula',              url: newDocUrls?.cedula,         stored: req.new_cedula_url },
                    { label: 'Diploma pregrado',    url: newDocUrls?.diploma,        stored: req.new_diploma_url },
                    { label: 'Diploma especializ.', url: newDocUrls?.especializacion, stored: req.new_especializacion_url },
                  ].filter((d) => d.stored).map(({ label, url }) => (
                    <div key={label} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                      <span className="text-sm font-medium text-slate-700">📄 {label}</span>
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors font-semibold">
                          Ver nuevo documento →
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">Enlace no disponible</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Reason */}
        {req.change_reason && (
          <div className="bg-slate-50 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Motivo del cambio</p>
            <p className="text-sm text-slate-700">{req.change_reason}</p>
          </div>
        )}

        {/* Admin note */}
        {showRejectInput && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nota para el médico (opcional)</label>
            <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)}
              rows={2} placeholder="Explica brevemente el motivo del rechazo..."
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors resize-none" />
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          <button onClick={handleApprove} disabled={processing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
            ✅ Aprobar cambios
          </button>
          {!showRejectInput ? (
            <button onClick={() => setShowRejectInput(true)} disabled={processing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 text-red-600 bg-white hover:bg-red-50 text-sm font-semibold transition-colors disabled:opacity-50">
              ❌ Rechazar
            </button>
          ) : (
            <>
              <button onClick={handleReject} disabled={processing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 text-red-600 bg-white hover:bg-red-50 text-sm font-semibold transition-colors disabled:opacity-50">
                {processing ? '...' : 'Confirmar rechazo'}
              </button>
              <button onClick={() => setShowRejectInput(false)} disabled={processing}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-500 text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50">
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function AprobacionesMedicosPage() {
  const { pendingDoctors, processingId, handleApprove, setRejectTarget, setRejectReason } = useAdminCtx()
  const { profile: adminProfile } = useAuth()
  const [tab, setTab] = useState<'aprobaciones' | 'solicitudes'>('aprobaciones')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [changeRequests, setChangeRequests] = useState<any[]>([])
  const [loadingCR,      setLoadingCR]      = useState(true)

  async function fetchChangeRequests() {
    setLoadingCR(true)
    const { data } = await supabase
      .from('doctor_change_requests')
      .select('*, doctor:doctor_id(id, full_name, email, specialty, phone, undergraduate_university, medical_license, doctor_description, bio)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    setChangeRequests(data ?? [])
    setLoadingCR(false)
  }

  useEffect(() => { fetchChangeRequests() }, [])

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Médicos</h1>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {([
          { key: 'aprobaciones' as const, label: 'Aprobaciones', count: pendingDoctors.length },
          { key: 'solicitudes'  as const, label: 'Solicitudes de cambio', count: changeRequests.length },
        ]).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px flex items-center gap-2 ${
              tab === key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
            {count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                tab === key ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Aprobaciones tab ── */}
      {tab === 'aprobaciones' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            {pendingDoctors.length > 0
              ? `${pendingDoctors.length} médico${pendingDoctors.length !== 1 ? 's' : ''} esperan aprobación`
              : 'No hay solicitudes pendientes'}
          </p>

          {pendingDoctors.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center py-16 text-slate-400">
              <span className="text-4xl mb-3">✅</span>
              <p className="text-sm font-medium">No hay médicos pendientes</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Pendientes</h2>
                <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingDoctors.length}</span>
              </div>
              {pendingDoctors.map((doctor) => (
                <PendingDoctorCard
                  key={doctor.id}
                  doctor={doctor}
                  processingId={processingId}
                  onApprove={handleApprove}
                  onReject={(d) => { setRejectTarget(d); setRejectReason('') }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Solicitudes de cambio tab ── */}
      {tab === 'solicitudes' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            {loadingCR
              ? 'Cargando solicitudes...'
              : changeRequests.length > 0
              ? `${changeRequests.length} solicitud${changeRequests.length !== 1 ? 'es' : ''} pendiente${changeRequests.length !== 1 ? 's' : ''} de revisión`
              : 'No hay solicitudes pendientes'}
          </p>

          {!loadingCR && changeRequests.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center py-16 text-slate-400">
              <span className="text-4xl mb-3">✅</span>
              <p className="text-sm font-medium">No hay solicitudes de cambio pendientes</p>
            </div>
          )}

          {changeRequests.map((req) => (
            <ChangeRequestCard
              key={req.id}
              req={req}
              adminId={adminProfile?.id ?? ''}
              onProcessed={fetchChangeRequests}
            />
          ))}
        </div>
      )}
    </div>
  )
}
