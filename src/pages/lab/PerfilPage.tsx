import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useLabContext } from '../../contexts/LabContext'
import LabNavBar from '../../components/LabNavBar'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LabData = any

const TYPE_LABELS: Record<string, string> = {
  laboratorio: 'Laboratorio clínico',
  imagenes:    'Centro de imágenes diagnósticas',
  ambos:       'Laboratorio e imágenes',
}

export default function LabPerfilPage() {
  const { lab: session, refreshLab } = useLabContext()
  const [lab,      setLab]      = useState<LabData | null>(null)
  const [exams,    setExams]    = useState<{ exam_name: string; category: string }[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState<string | null>(null)

  const [name,    setName]    = useState('')
  const [phone,   setPhone]   = useState('')
  const [address, setAddress] = useState('')
  const [city,    setCity]    = useState('')

  const fetchData = useCallback(async () => {
    if (!session) return
    setLoading(true)
    const [{ data: labData }, { data: examData }] = await Promise.all([
      supabase.rpc('get_lab_by_id',       { p_id: session.id }),
      supabase.rpc('get_lab_exam_types',  { p_lab_id: session.id }),
    ])
    if (labData) {
      setLab(labData)
      setName(labData.name ?? '')
      setPhone(labData.phone ?? '')
      setAddress(labData.address ?? '')
      setCity(labData.city ?? '')
    }
    setExams((examData ?? []) as { exam_name: string; category: string }[])
    setLoading(false)
  }, [session])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.rpc('update_lab_profile', {
      p_id: session!.id, p_name: name.trim(),
      p_phone: phone.trim(), p_address: address.trim(), p_city: city.trim(),
    })
    await refreshLab()
    setToast('✅ Perfil actualizado')
    setTimeout(() => setToast(null), 3000)
    setSaving(false)
  }

  const labExams = exams.filter((e) => e.category === 'laboratorio')
  const imgExams = exams.filter((e) => e.category === 'imagenes')

  return (
    <div className="min-h-screen bg-slate-50">
      <LabNavBar />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-lg">
          {toast}
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Perfil del centro</h1>
          <p className="text-slate-500 text-sm mt-1">Información de tu centro aliado.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Editable fields */}
            <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <h2 className="text-base font-bold text-slate-900">Información editable</h2>

              {[
                { id: 'name',    label: 'Nombre del centro', value: name,    set: setName,    type: 'text' },
                { id: 'phone',   label: 'Teléfono',          value: phone,   set: setPhone,   type: 'tel' },
                { id: 'address', label: 'Dirección',         value: address, set: setAddress, type: 'text' },
                { id: 'city',    label: 'Ciudad',            value: city,    set: setCity,    type: 'text' },
              ].map(({ id, label, value, set, type }) => (
                <div key={id}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
                  <input type={type} value={value} onChange={(e) => set(e.target.value)} required
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors" />
                </div>
              ))}

              <button type="submit" disabled={saving}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-60">
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </form>

            {/* Read-only fields */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
              <h2 className="text-base font-bold text-slate-900 mb-1">Información del registro</h2>
              <p className="text-xs text-slate-400">Para cambiar estos campos contacta a hola@contigomedicina.com</p>
              {[
                { label: 'Correo',           value: lab?.email },
                { label: 'Tipo de centro',   value: TYPE_LABELS[lab?.type] ?? lab?.type },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm text-slate-500">{label}</span>
                  <span className="text-sm font-semibold text-slate-800 text-right">{value ?? '—'}</span>
                </div>
              ))}
            </div>

            {/* Exams */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Exámenes disponibles</h2>
                <p className="text-xs text-slate-400 mt-1">Para cambios en los servicios contacta a hola@contigomedicina.com</p>
              </div>

              {labExams.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">🧪 Laboratorio Clínico</p>
                  <div className="flex flex-wrap gap-2">
                    {labExams.map((e) => (
                      <span key={e.exam_name} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">{e.exam_name}</span>
                    ))}
                  </div>
                </div>
              )}

              {imgExams.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">📷 Imágenes Diagnósticas</p>
                  <div className="flex flex-wrap gap-2">
                    {imgExams.map((e) => (
                      <span key={e.exam_name} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">{e.exam_name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Documents */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-base font-bold text-slate-900 mb-4">Documentos</h2>
              <div className="space-y-3">
                {[
                  { label: 'Cámara de Comercio',    url: lab?.camara_comercio_url },
                  { label: 'Habilitación Supersalud', url: lab?.habilitacion_supersalud_url },
                  { label: 'RUT',                   url: lab?.rut_url },
                ].map(({ label, url }) => (
                  <div key={label} className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📄</span>
                      <span className="text-sm font-medium text-slate-700">{label}</span>
                    </div>
                    {url ? (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">✓ Subido</span>
                    ) : (
                      <span className="text-xs text-slate-400">No subido</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
