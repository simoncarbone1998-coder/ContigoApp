import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAdminCtx } from './AdminContext'

const LAB_TYPE_LABELS: Record<string, string> = {
  laboratorio: 'Laboratorio clínico',
  imagenes:    'Centro de imágenes diagnósticas',
  ambos:       'Laboratorio clínico e imágenes',
}

const LAB_STATUS_COLORS: Record<string, string> = {
  pending:  'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
}
const LAB_STATUS_LABELS: Record<string, string> = {
  pending:  'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
}

type DocUrls = { camara: string | null; habilitacion: string | null; rut: string | null }

async function fetchSignedUrls(lab: {
  camara_comercio_url?: string | null
  habilitacion_supersalud_url?: string | null
  rut_url?: string | null
}): Promise<DocUrls> {
  async function sign(path: string | null | undefined): Promise<string | null> {
    if (!path) return null
    if (path.startsWith('http')) return path // legacy public URL
    const { data } = await supabase.storage.from('lab-documents').createSignedUrl(path, 3600)
    return data?.signedUrl ?? null
  }
  const [camara, habilitacion, rut] = await Promise.all([
    sign(lab.camara_comercio_url),
    sign(lab.habilitacion_supersalud_url),
    sign(lab.rut_url),
  ])
  return { camara, habilitacion, rut }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PendingLabCard({ lab, processingId, onApprove, onReject }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lab: any
  processingId: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onApprove: (lab: any) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onReject: (lab: any) => void
}) {
  const [expanded,  setExpanded]  = useState(false)
  const [docUrls,   setDocUrls]   = useState<DocUrls | null>(null)
  const [loadingDocs, setLoadingDocs] = useState(false)

  async function handleExpand() {
    if (!expanded && !docUrls) {
      setLoadingDocs(true)
      const urls = await fetchSignedUrls(lab)
      setDocUrls(urls)
      setLoadingDocs(false)
    }
    setExpanded((v) => !v)
  }

  const docList = [
    { label: 'Cámara de Comercio',    url: docUrls?.camara,        stored: lab.camara_comercio_url },
    { label: 'Habilitación Supersalud', url: docUrls?.habilitacion, stored: lab.habilitacion_supersalud_url },
    { label: 'RUT',                   url: docUrls?.rut,            stored: lab.rut_url },
  ]

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
      {/* Card header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4">
        <div className="min-w-0">
          <p className="font-bold text-slate-900 text-base">{lab.name}</p>
          <p className="text-sm text-slate-500">{lab.email} · {lab.city}</p>
          <p className="text-xs text-slate-400 mt-0.5">{LAB_TYPE_LABELS[lab.type] ?? lab.type}</p>
          {lab.exams && lab.exams.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {lab.exams.slice(0, 5).map((e: { exam_name: string }) => (
                <span key={e.exam_name} className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">{e.exam_name}</span>
              ))}
              {lab.exams.length > 5 && <span className="text-xs text-slate-400">+{lab.exams.length - 5} más</span>}
            </div>
          )}
        </div>
        <div className="flex flex-col sm:items-end gap-2 shrink-0">
          <div className="flex gap-2">
            <button onClick={() => onApprove(lab)} disabled={processingId === lab.id}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
              {processingId === lab.id ? '...' : 'Aprobar'}
            </button>
            <button onClick={() => onReject(lab)} disabled={processingId === lab.id}
              className="px-4 py-2 rounded-xl border border-red-200 text-red-600 bg-white hover:bg-red-50 text-sm font-semibold transition-colors disabled:opacity-50">
              Rechazar
            </button>
          </div>
          <button
            onClick={handleExpand}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors flex items-center gap-1"
          >
            {expanded ? 'Ocultar ▲' : 'Ver información completa ▼'}
          </button>
        </div>
      </div>

      {/* Expandable detail */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-5 space-y-5">
          {/* Info grid */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Información del centro</p>
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              {[
                { label: 'Nombre',       value: lab.name },
                { label: 'Tipo',         value: LAB_TYPE_LABELS[lab.type] ?? lab.type },
                { label: 'Ciudad',       value: lab.city },
                { label: 'Dirección',    value: lab.address },
                { label: 'Teléfono',     value: lab.phone },
                { label: 'Email',        value: lab.email },
                { label: 'Registro',     value: lab.created_at ? new Date(lab.created_at).toLocaleDateString('es-CO') : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-2">
                  <span className="text-slate-400 font-medium w-24 shrink-0">{label}</span>
                  <span className="text-slate-800 font-semibold">{value ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* All exams */}
          {lab.exams && lab.exams.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Exámenes ofrecidos ({lab.exams.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {lab.exams.map((e: { exam_name: string }) => (
                  <span key={e.exam_name} className="text-xs px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700">{e.exam_name}</span>
                ))}
              </div>
            </div>
          )}

          {/* Documents */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Documentos</p>
            {loadingDocs ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className="w-3 h-3 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                Generando enlaces...
              </div>
            ) : (
              <div className="space-y-2">
                {docList.map(({ label, url, stored }) => (
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
                      <span className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full shrink-0">No subido</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AprobacionesLaboratoriosPage() {
  const {
    allLabs, labProcessingId, handleLabApprove,
    setLabRejectTarget, setLabRejectReason,
  } = useAdminCtx()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pending  = (allLabs as any[]).filter((l) => l.status === 'pending')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const approved = (allLabs as any[]).filter((l) => l.status === 'approved')

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Centros Diagnóstico</h1>
        <p className="text-sm text-slate-500 mt-1">
          {pending.length > 0
            ? `${pending.length} centro${pending.length !== 1 ? 's' : ''} esperan aprobación`
            : 'Todos los centros han sido revisados'}
        </p>
      </div>

      {allLabs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center py-16 text-slate-400">
          <span className="text-4xl mb-3">🔬</span>
          <p className="text-sm font-medium">No hay centros registrados aún.</p>
        </div>
      ) : (
        <>
          {/* Pending */}
          {pending.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Pendientes</h2>
                <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pending.length}</span>
              </div>
              {pending.map((lab) => (
                <PendingLabCard
                  key={lab.id}
                  lab={lab}
                  processingId={labProcessingId}
                  onApprove={handleLabApprove}
                  onReject={(l) => { setLabRejectTarget(l); setLabRejectReason('') }}
                />
              ))}
            </div>
          )}

          {/* Active */}
          {approved.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Centros activos ({approved.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Centro', 'Tipo', 'Ciudad', 'Exámenes', 'Completados', 'Estado'].map((h) => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {approved.map((lab) => (
                      <tr key={lab.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">{lab.name}</td>
                        <td className="py-3.5 px-4 text-slate-500 text-xs">{LAB_TYPE_LABELS[lab.type] ?? lab.type}</td>
                        <td className="py-3.5 px-4 text-slate-500">{lab.city ?? '—'}</td>
                        <td className="py-3.5 px-4 text-slate-700">{lab.exam_count}</td>
                        <td className="py-3.5 px-4 text-slate-700">{lab.completed_count}</td>
                        <td className="py-3.5 px-4">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${LAB_STATUS_COLORS[lab.status] ?? ''}`}>
                            {LAB_STATUS_LABELS[lab.status] ?? lab.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
