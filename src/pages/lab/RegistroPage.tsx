import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { setLabSession } from '../../lib/labAuth'

const BG = { background: 'linear-gradient(135deg, #1e3a5f 0%, #16a34a 100%)' }

const LAB_EXAMS = [
  { name: 'Hemograma completo',              category: 'laboratorio' },
  { name: 'Glucosa en ayunas',               category: 'laboratorio' },
  { name: 'Perfil lipídico',                 category: 'laboratorio' },
  { name: 'Creatinina / BUN',                category: 'laboratorio' },
  { name: 'TSH (tiroides)',                  category: 'laboratorio' },
  { name: 'Uroanálisis',                     category: 'laboratorio' },
  { name: 'Cultivo de orina',                category: 'laboratorio' },
  { name: 'Hemoglobina glicosilada (HbA1c)', category: 'laboratorio' },
  { name: 'Transaminasas (AST/ALT)',          category: 'laboratorio' },
  { name: 'Prueba de embarazo (Beta HCG)',    category: 'laboratorio' },
]
const IMG_EXAMS = [
  { name: 'Radiografía de tórax',                    category: 'imagenes' },
  { name: 'Radiografía de columna',                  category: 'imagenes' },
  { name: 'Radiografía de extremidades',             category: 'imagenes' },
  { name: 'Ecografía abdominal',                     category: 'imagenes' },
  { name: 'Ecografía pélvica',                       category: 'imagenes' },
  { name: 'Ecografía obstétrica',                    category: 'imagenes' },
  { name: 'TAC de cráneo',                           category: 'imagenes' },
  { name: 'TAC de tórax',                            category: 'imagenes' },
  { name: 'Resonancia magnética (MRI) de columna',   category: 'imagenes' },
  { name: 'Resonancia magnética (MRI) de rodilla',   category: 'imagenes' },
]

type ExamCheck = { exam_name: string; category: string; price_cop: string; selected: boolean }

function buildExamList(type: string): ExamCheck[] {
  const all: ExamCheck[] = []
  if (type === 'laboratorio' || type === 'ambos')
    all.push(...LAB_EXAMS.map((e) => ({ ...e, exam_name: e.name, price_cop: '', selected: false })))
  if (type === 'imagenes' || type === 'ambos')
    all.push(...IMG_EXAMS.map((e) => ({ ...e, exam_name: e.name, price_cop: '', selected: false })))
  return all
}

type UploadState = 'idle' | 'uploading' | 'done'

export default function LabRegistroPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)

  // Step 1 fields
  const [name,            setName]            = useState('')
  const [type,            setType]            = useState('')
  const [city,            setCity]            = useState('')
  const [address,         setAddress]         = useState('')
  const [phone,           setPhone]           = useState('')
  const [email,           setEmail]           = useState('')
  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Step 2 fields
  const [exams, setExams] = useState<ExamCheck[]>([])

  // Step 3 fields
  const [camaraFile,       setCamaraFile]       = useState<File | null>(null)
  const [habilitacionFile, setHabilitacionFile] = useState<File | null>(null)
  const [rutFile,          setRutFile]          = useState<File | null>(null)
  const [camaraState,      setCamaraState]      = useState<UploadState>('idle')
  const [habilitacionState,setHabilitacionState]= useState<UploadState>('idle')
  const [rutState,         setRutState]         = useState<UploadState>('idle')

  const camaraRef       = useRef<HTMLInputElement>(null)
  const habilitacionRef = useRef<HTMLInputElement>(null)
  const rutRef          = useRef<HTMLInputElement>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  function goToStep2() {
    setError(null)
    if (!name.trim() || !type || !city.trim() || !address.trim() || !phone.trim() || !email.trim())
      return setError('Completa todos los campos.')
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    if (password !== confirmPassword) return setError('Las contraseñas no coinciden.')
    setExams(buildExamList(type))
    setStep(2)
  }

  function toggleExam(idx: number) {
    setExams((prev) => prev.map((e, i) => i === idx ? { ...e, selected: !e.selected } : e))
  }
  function setPrice(idx: number, val: string) {
    setExams((prev) => prev.map((e, i) => i === idx ? { ...e, price_cop: val } : e))
  }

  function goToStep3() {
    setError(null)
    if (!exams.some((e) => e.selected)) return setError('Selecciona al menos un servicio.')
    setStep(3)
  }

  async function uploadDoc(file: File, labId: string, docType: string): Promise<string> {
    const ext  = file.name.split('.').pop()
    const path = `${labId}/${docType}.${ext}`
    const { error } = await supabase.storage.from('lab-documents').upload(path, file, { upsert: true })
    if (error) throw new Error(`Error subiendo ${docType}`)
    const { data: { publicUrl } } = supabase.storage.from('lab-documents').getPublicUrl(path)
    return publicUrl
  }

  async function handleSubmit() {
    setError(null)
    if (!camaraFile || !habilitacionFile || !rutFile)
      return setError('Sube los tres documentos requeridos.')

    setSubmitting(true)

    // Register lab without docs first to get the ID
    const { data: labData, error: regErr } = await supabase.rpc('register_lab', {
      p_name: name.trim(), p_email: email.trim(), p_password: password,
      p_phone: phone.trim(), p_address: address.trim(), p_city: city.trim(), p_type: type,
    })
    if (regErr || !labData) {
      const msg = regErr?.message ?? ''
      setError(msg.includes('email_exists') ? 'Este correo ya está registrado.' : 'Error al crear la cuenta. Intenta de nuevo.')
      setSubmitting(false); return
    }

    const lab = labData as { id: string; name: string; email: string; status: string; type: string; city: string; phone: string; address: string }

    // Upload documents
    try {
      setCamaraState('uploading')
      const camaraUrl = await uploadDoc(camaraFile, lab.id, 'camara_comercio')
      setCamaraState('done')

      setHabilitacionState('uploading')
      const habilitacionUrl = await uploadDoc(habilitacionFile, lab.id, 'habilitacion_supersalud')
      setHabilitacionState('done')

      setRutState('uploading')
      const rutUrl = await uploadDoc(rutFile, lab.id, 'rut')
      setRutState('done')

      await supabase.rpc('update_lab_docs', {
        p_id: lab.id,
        p_camara_comercio_url: camaraUrl,
        p_habilitacion_supersalud_url: habilitacionUrl,
        p_rut_url: rutUrl,
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error subiendo documentos.')
      setSubmitting(false); return
    }

    // Insert selected exam types
    const selectedExams = exams.filter((e) => e.selected).map((e) => ({
      exam_name: e.exam_name, category: e.category,
      price_cop: e.price_cop ? parseFloat(e.price_cop) : null,
    }))
    await supabase.rpc('insert_lab_exam_types', {
      p_laboratory_id: lab.id,
      p_exams: JSON.stringify(selectedExams),
    })

    // Notify admin
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          to: 'simoncarbone1998@gmail.com',
          subject: '🔬 Nuevo centro aliado pendiente — Contigo',
          html: `
            <p>Un nuevo centro se ha registrado y está pendiente de aprobación.</p>
            <br/>
            <p><strong>Nombre:</strong> ${name.trim()}</p>
            <p><strong>Tipo:</strong> ${type}</p>
            <p><strong>Ciudad:</strong> ${city.trim()}</p>
            <p><strong>Email:</strong> ${email.trim()}</p>
            <p><strong>Servicios:</strong> ${selectedExams.map((e) => e.exam_name).join(', ')}</p>
            <br/>
            <p><a href="https://contigomedicina.com/admin/dashboard">Ver en panel admin →</a></p>
          `,
        },
      })
    } catch { /* non-critical */ }

    setLabSession({
      id: lab.id, name: lab.name, email: lab.email,
      status: 'pending', type: lab.type as 'laboratorio' | 'imagenes' | 'ambos',
      city: lab.city, phone: lab.phone, address: lab.address,
    })

    setSubmitting(false)
    setStep(4)
  }

  const labExams = exams.filter((e) => e.category === 'laboratorio')
  const imgExams = exams.filter((e) => e.category === 'imagenes')

  if (step === 4) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12" style={BG}>
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h1 className="text-xl font-bold text-slate-900">¡Solicitud enviada!</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Revisaremos tu información y documentos. Te notificaremos por email
            cuando tu centro sea aprobado. Este proceso puede tomar 1–3 días hábiles.
          </p>
          <button
            onClick={() => { navigate('/lab/pending') }}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm mt-2 transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #16a34a 100%)' }}
          >
            Ver estado de mi solicitud
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={BG}>
      <Link to="/lab/login" className="fixed top-4 left-4 z-10 text-white/80 hover:text-white text-sm font-medium hover:underline transition-colors">
        ← Volver
      </Link>

      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="Contigo" className="h-12 w-auto mb-3" />
          <h1 className="text-lg font-bold text-white">Registro de Centro Aliado</h1>
          <p className="text-white/60 text-sm mt-1">Paso {step} de 3</p>
          <div className="flex gap-2 mt-3">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`h-1.5 w-12 rounded-full transition-colors ${s <= step ? 'bg-white' : 'bg-white/25'}`} />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl px-8 py-8" style={{ maxHeight: '80vh', overflowY: 'auto' }}>

          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex gap-2">
              <svg className="w-4 h-4 shrink-0 mt-0.5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900 mb-2">Información del centro</h2>

              {[
                { id: 'name',    label: 'Nombre del centro',       value: name,    set: setName,    ph: 'Laboratorio Clínico XYZ', type: 'text' },
                { id: 'city',    label: 'Ciudad',                   value: city,    set: setCity,    ph: 'ej: Bogotá',              type: 'text' },
                { id: 'address', label: 'Dirección',                value: address, set: setAddress, ph: 'ej: Calle 45 #23-10',     type: 'text' },
                { id: 'phone',   label: 'Teléfono',                 value: phone,   set: setPhone,   ph: 'ej: 6012345678',          type: 'tel' },
                { id: 'email',   label: 'Correo electrónico',       value: email,   set: setEmail,   ph: 'admin@centro.com',        type: 'email' },
              ].map(({ id, label, value, set, ph, type: t }) => (
                <div key={id}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
                  <input type={t} required value={value} onChange={(e) => set(e.target.value)} placeholder={ph}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors" />
                </div>
              ))}

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tipo de centro</label>
                <select value={type} onChange={(e) => setType(e.target.value)} required
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 bg-white transition-colors">
                  <option value="">Seleccionar...</option>
                  <option value="laboratorio">Laboratorio clínico</option>
                  <option value="imagenes">Centro de imágenes diagnósticas</option>
                  <option value="ambos">Ambos (laboratorio e imágenes)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'pwd',  label: 'Contraseña',        value: password,        set: setPassword,        ph: '••••••••', ac: 'new-password' },
                  { id: 'cpwd', label: 'Confirmar contraseña', value: confirmPassword, set: setConfirmPassword, ph: '••••••••', ac: 'new-password' },
                ].map(({ id, label, value, set, ph, ac }) => (
                  <div key={id}>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
                    <input type="password" required value={value} onChange={(e) => set(e.target.value)} placeholder={ph} autoComplete={ac}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors" />
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400">Mínimo 6 caracteres</p>

              <button onClick={goToStep2}
                className="w-full mt-2 py-3.5 rounded-xl text-white text-sm font-semibold transition-all hover:shadow-lg hover:scale-[1.01]"
                style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #16a34a 100%)' }}>
                Continuar →
              </button>
              <p className="text-center text-sm text-slate-500 mt-2">
                ¿Ya tienes cuenta?{' '}
                <Link to="/lab/login" className="text-emerald-700 font-semibold hover:underline">Iniciar sesión</Link>
              </p>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-slate-900">Servicios disponibles</h2>
              <p className="text-sm text-slate-500">Selecciona los exámenes que ofrece tu centro e ingresa el precio.</p>

              {labExams.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">🧪 Laboratorio Clínico</h3>
                  <div className="space-y-2">
                    {labExams.map((exam, i) => {
                      const idx = exams.indexOf(exam)
                      return (
                        <div key={exam.exam_name} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${exam.selected ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                          <input type="checkbox" checked={exam.selected} onChange={() => toggleExam(idx)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0" id={`exam-${i}`} />
                          <label htmlFor={`exam-${i}`} className="flex-1 text-sm text-slate-800 font-medium cursor-pointer">{exam.exam_name}</label>
                          {exam.selected && (
                            <input type="number" value={exam.price_cop} onChange={(e) => setPrice(idx, e.target.value)}
                              placeholder="Precio COP" min="0" step="1000"
                              className="w-32 border border-emerald-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-colors text-right" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {imgExams.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">📷 Imágenes Diagnósticas</h3>
                  <div className="space-y-2">
                    {imgExams.map((exam, i) => {
                      const idx = exams.indexOf(exam)
                      return (
                        <div key={exam.exam_name} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${exam.selected ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                          <input type="checkbox" checked={exam.selected} onChange={() => toggleExam(idx)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0" id={`img-${i}`} />
                          <label htmlFor={`img-${i}`} className="flex-1 text-sm text-slate-800 font-medium cursor-pointer">{exam.exam_name}</label>
                          {exam.selected && (
                            <input type="number" value={exam.price_cop} onChange={(e) => setPrice(idx, e.target.value)}
                              placeholder="Precio COP" min="0" step="1000"
                              className="w-32 border border-emerald-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-colors text-right" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                  ← Atrás
                </button>
                <button onClick={goToStep3}
                  className="flex-1 py-3 rounded-xl text-white text-sm font-semibold transition-all hover:shadow-lg hover:scale-[1.01]"
                  style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #16a34a 100%)' }}>
                  Continuar →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Documentos requeridos</h2>
                <p className="text-sm text-slate-500 mt-1">Necesitamos verificar tu centro antes de aprobarlo. Solo PDF, máximo 10 MB.</p>
              </div>

              {[
                { label: 'Cámara de Comercio', helper: 'Certificado de existencia y representación legal vigente', ref: camaraRef, file: camaraFile, setFile: setCamaraFile, state: camaraState },
                { label: 'Habilitación Supersalud', helper: 'Certificado de habilitación como prestador de servicios de salud', ref: habilitacionRef, file: habilitacionFile, setFile: setHabilitacionFile, state: habilitacionState },
                { label: 'RUT', helper: 'Registro Único Tributario actualizado', ref: rutRef, file: rutFile, setFile: setRutFile, state: rutState },
              ].map(({ label, helper, ref, file, setFile, state }) => (
                <div key={label}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</label>
                  <p className="text-xs text-slate-400 mb-2">{helper}</p>
                  <div className={`flex items-center justify-between gap-3 p-4 rounded-xl border-2 border-dashed transition-colors ${
                    file ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xl">📄</span>
                      {file ? (
                        <span className="text-sm text-emerald-700 font-medium truncate">{file.name}</span>
                      ) : (
                        <span className="text-sm text-slate-500">Sin archivo</span>
                      )}
                      {state === 'uploading' && <span className="text-xs text-blue-600 font-medium shrink-0">Subiendo...</span>}
                      {state === 'done'      && <span className="text-xs text-emerald-600 font-medium shrink-0">✓</span>}
                    </div>
                    <button type="button"
                      onClick={() => ref.current?.click()}
                      className="shrink-0 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
                      {file ? 'Cambiar' : 'Subir PDF'}
                    </button>
                    <input ref={ref} type="file" accept="application/pdf" className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        if (f.size > 10 * 1024 * 1024) { setError('El archivo no puede superar 10 MB.'); return }
                        setFile(f); setError(null)
                      }} />
                  </div>
                </div>
              ))}

              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                ⏳ Tu centro será revisado por nuestro equipo. Te notificaremos por email cuando sea aprobado.
              </p>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(2)} disabled={submitting}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                  ← Atrás
                </button>
                <button onClick={handleSubmit} disabled={submitting}
                  className="flex-1 py-3 rounded-xl text-white text-sm font-semibold transition-all hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #16a34a 100%)' }}>
                  {submitting ? 'Enviando...' : 'Enviar solicitud'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
