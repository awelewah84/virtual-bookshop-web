import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useToast } from '../hooks/useToast'
import {
  activateStaffUser,
  createStaffUser,
  deactivateStaffUser,
  listStaffUsers,
  resetStaffUserPassword,
} from '../lib/api'

export function StaffUsersPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const usersQuery = useQuery({ queryKey: ['staff-users'], queryFn: listStaffUsers })

  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [newStaffId, setNewStaffId] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [resetStaffId, setResetStaffId] = useState('')
  const [resetPassword, setResetPassword] = useState('')

  const createMutation = useMutation({
    mutationFn: createStaffUser,
    onSuccess: async () => {
      setNewFirstName('')
      setNewLastName('')
      setNewStaffId('')
      setNewPassword('')
      toast.success('Staff user created.')
      await queryClient.invalidateQueries({ queryKey: ['staff-users'] })
    },
    onError: (error) => toast.error(error.message),
  })

  const resetMutation = useMutation({
    mutationFn: async (payload: { staffId: string; password: string }) =>
      resetStaffUserPassword(payload.staffId, { password: payload.password }),
    onSuccess: async () => {
      setResetStaffId('')
      setResetPassword('')
      toast.success('Staff password reset.')
      await queryClient.invalidateQueries({ queryKey: ['staff-users'] })
    },
    onError: (error) => toast.error(error.message),
  })

  const deactivateMutation = useMutation({
    mutationFn: deactivateStaffUser,
    onSuccess: async () => {
      toast.success('Staff user deactivated.')
      await queryClient.invalidateQueries({ queryKey: ['staff-users'] })
    },
    onError: (error) => toast.error(error.message),
  })

  const activateMutation = useMutation({
    mutationFn: activateStaffUser,
    onSuccess: async () => {
      toast.success('Staff user activated.')
      await queryClient.invalidateQueries({ queryKey: ['staff-users'] })
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <div className="panel-grid">
      <section className="panel">
        <h2>Create Staff User</h2>
        <p className="panel-note">Protected endpoint: POST /api/staff/admin/users</p>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            const firstName = newFirstName.trim()
            const lastName = newLastName.trim()
            const staffId = newStaffId.trim()
            const password = newPassword.trim()

            if (!firstName || !staffId || !password) {
              toast.error('First name, staff ID, and password are required.')
              return
            }

            createMutation.mutate({ firstName, lastName, staffId, password })
          }}
        >
          <label className="field">
            <span>First Name</span>
            <input value={newFirstName} onChange={(event) => setNewFirstName(event.target.value)} required />
            <small>{'\u00a0'}</small>
          </label>

          <label className="field">
            <span>Last Name</span>
            <input value={newLastName} onChange={(event) => setNewLastName(event.target.value)} />
            <small>{'\u00a0'}</small>
          </label>

          <label className="field">
            <span>Staff ID</span>
            <input value={newStaffId} onChange={(event) => setNewStaffId(event.target.value)} required />
            <small>{'\u00a0'}</small>
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
            <small>{'\u00a0'}</small>
          </label>

          <button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create User'}
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Reset Staff Password</h2>
        <p className="panel-note">Protected endpoint: PATCH /api/staff/admin/users/:staffId/password</p>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            resetMutation.mutate({ staffId: resetStaffId, password: resetPassword })
          }}
        >
          <label className="field">
            <span>Staff ID</span>
            <input value={resetStaffId} onChange={(event) => setResetStaffId(event.target.value)} required />
            <small>{'\u00a0'}</small>
          </label>

          <label className="field">
            <span>New Password</span>
            <input
              type="password"
              value={resetPassword}
              onChange={(event) => setResetPassword(event.target.value)}
              required
            />
            <small>{'\u00a0'}</small>
          </label>

          <button type="submit" disabled={resetMutation.isPending}>
            {resetMutation.isPending ? 'Updating...' : 'Reset Password'}
          </button>
        </form>
      </section>

      <section className="panel panel-span-full">
        <h2>Staff Users</h2>
        <p className="panel-note">Current staff directory and account status.</p>

        {usersQuery.isError && <div className="error-banner">{usersQuery.error.message}</div>}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Staff ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(usersQuery.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={5}>No staff users found.</td>
                </tr>
              )}

              {(usersQuery.data ?? []).map((user, index) => {
                const staffId = String(user.staffId ?? `staff-${index}`)
                const isActive = Boolean(user.isActive)
                const lastLogin = user.lastLogin ? new Date(String(user.lastLogin)).toLocaleString() : '-'
                const firstName = String(user.firstName ?? '').trim()
                const lastName = String(user.lastName ?? '').trim()
                const displayName = `${firstName} ${lastName}`.trim() || '-'

                return (
                  <tr key={staffId}>
                    <td>{staffId}</td>
                    <td>{displayName}</td>
                    <td>{isActive ? 'Active' : 'Inactive'}</td>
                    <td>{lastLogin}</td>
                    <td>
                      {isActive ? (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => deactivateMutation.mutate(staffId)}
                          disabled={deactivateMutation.isPending}
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => activateMutation.mutate(staffId)}
                          disabled={activateMutation.isPending}
                        >
                          Activate
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  )
}
