import { useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { clearAccessToken, getAccessToken, setAccessToken } from './authStorage'
import { loginStaff } from '../lib/api'
import { AuthContext, type AuthContextValue } from './authContext'

export function AuthProvider({ children }: PropsWithChildren) {
  const [accessToken, setAccessTokenState] = useState<string>(() => getAccessToken())

  const value = useMemo<AuthContextValue>(() => {
    return {
      isAuthenticated: accessToken.length > 0,
      accessToken,
      login: async (staffId: string, password: string) => {
        const result = await loginStaff({ staffId, password })
        setAccessToken(result.accessToken)
        setAccessTokenState(result.accessToken)
      },
      logout: () => {
        clearAccessToken()
        setAccessTokenState('')
      },
    }
  }, [accessToken])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
