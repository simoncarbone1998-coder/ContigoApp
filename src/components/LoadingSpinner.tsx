interface Props {
  message?: string
}

export default function LoadingSpinner({ message = 'Cargando...' }: Props) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
      <div className="w-11 h-11 border-4 border-blue-100 border-t-blue-700 rounded-full animate-spin" />
      <p className="text-sm text-slate-500 font-medium">{message}</p>
    </div>
  )
}
