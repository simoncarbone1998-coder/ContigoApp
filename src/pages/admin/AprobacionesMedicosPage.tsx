import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAdminCtx } from './AdminContext'
import { specialtyLabel } from '../../lib/types'

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
    { label: 'Cédula de ciudadanía',     url: docUrls?.cedula,        stored: doctor.cedula_url,                  naLabel: 'No subido' },
    { label: 'Diploma de pregrado',      url: docUrls?.diploma,       stored: doctor.diploma_pregrado_url,        naLabel: 'No subido' },
    { label: 'Diploma de especialización', url: docUrls?.especializacion, stored: doctor.diploma_especializacion_url, naLabel: 'No aplica' },
  ]

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
      {/* Card header */}
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
          <button
            onClick={handleExpand}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors flex items-center gap-1"
          >
            {expanded ? 'Ocultar ▲' : 'Ver documentos y verificación ▼'}
          </button>
        </div>
      </div>

      {/* Expandable detail */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-5 space-y-5">

          {/* Documents */}
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

          {/* RETHUS verification */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Verificación en RETHUS</p>
            <p className="text-xs text-slate-400 mb-3">
              Verifica la tarjeta profesional en el registro oficial del Ministerio de Salud.
            </p>
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-4 space-y-3">
              <a
                href="https://www.minsalud.gov.co/Paginas/rethus.aspx"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
              >
                🔍 Verificar en RETHUS →
              </a>
              {doctor.medical_license && (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-slate-500">
                    Tarjeta profesional:{' '}
                    <span className="font-mono font-semibold text-slate-900">{doctor.medical_license}</span>
                  </span>
                  <button
                    onClick={copyLicense}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                  >
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

export default function AprobacionesMedicosPage() {
  const {
    pendingDoctors, processingId, handleApprove, setRejectTarget, setRejectReason,
  } = useAdminCtx()

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Médicos</h1>
        <p className="text-sm text-slate-500 mt-1">
          {pendingDoctors.length > 0
            ? `${pendingDoctors.length} médico${pendingDoctors.length !== 1 ? 's' : ''} esperan aprobación`
            : 'No hay solicitudes pendientes'}
        </p>
      </div>

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
  )
}
