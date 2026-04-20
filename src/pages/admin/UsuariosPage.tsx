import { useAdminCtx } from './AdminContext'
import { UsersSection } from './DashboardPage'

export default function UsuariosPage() {
  const {
    allUsers, userSearch, setUserSearch, userRoleFilter, setUserRoleFilter,
    roleChanging, setConfirmTarget, setConfirmInput, setDetailUser, doctorAvgMap,
    adminProfile,
  } = useAdminCtx()

  const filteredUsers = allUsers.filter((u) => {
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter
    const q = userSearch.toLowerCase()
    const matchesSearch = !q || (u.full_name ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q)
    return matchesRole && matchesSearch
  })

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Usuarios</h1>
        <p className="text-sm text-slate-500 mt-1">Gestiona los roles y permisos de todos los usuarios.</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <UsersSection
          users={filteredUsers}
          search={userSearch}
          onSearchChange={setUserSearch}
          roleFilter={userRoleFilter}
          onRoleFilterChange={setUserRoleFilter}
          currentAdminId={adminProfile?.id ?? null}
          roleChanging={roleChanging}
          onRoleChange={(user, newRole) => { setConfirmTarget({ user, newRole }); setConfirmInput('') }}
          onDetail={setDetailUser}
          ratingMap={doctorAvgMap}
        />
      </div>
    </div>
  )
}
