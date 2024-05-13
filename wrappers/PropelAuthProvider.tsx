import * as base64 from 'base-64'
import * as AuthSession from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import { ReactNode, createContext, useContext, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const REFRESH_TOKEN = 'refreshToken'
const ACCESS_TOKEN = 'accessToken'
const ACCESS_TOKEN_ISSUED_AT = 'accessTokenIssuedAt'
const ACCESS_TOKEN_EXPIRES_IN = 'accessTokenExpiresIn'
const REFRESH_IN = 5 * 60 * 1000 // 5 mins

WebBrowser.maybeCompleteAuthSession()

type SavedTokens = {
  refreshToken: string
  accessToken: string
  issuedAt: number
  expiresIn: number
}

export type AccountPageUrlOptions = {
  redirectUriType: 'default' | 'custom' | 'none'
  redirectUri?: string
}

export type AuthContextType<User> = {
  ready: boolean
  loading: boolean
  accessToken: string
  user: User | null
  login: () => Promise<void>
  logout: () => Promise<void>
  getToken: () => Promise<string>
  getUser: () => Promise<User | null>
  getAccountPageUrl: (options: AccountPageUrlOptions) => string
}

export type PropelAuthConfig = {
  clientId: string
  authUrl: string
  discovery: AuthSession.DiscoveryDocument
  redirectUri: string
  clientSecret?: string
}

export const PropelAuthProvider = ({
  children,
  config: { authUrl, clientId, discovery, redirectUri, clientSecret },
}: Props) => {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [accessToken, setAccessToken] = useState<string>('')
  const [cachedTokens, setCachedTokens] = useState<SavedTokens | null>(null)

  const [authRequest, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId,
      responseType: AuthSession.ResponseType.Code,
      redirectUri,
      usePKCE: true,
    },
    discovery
  )

  const login = async (): Promise<void> => {
    setLoading(true)
    try {
      const result = await promptAsync({ createTask: false })
      // REVIEW: check if other types need special handling
      if (result.type !== 'success' || !authRequest) {
        setLoading(false)
        await logout()
        return
      }

      const code = result.params.code
      const tokens = await AuthSession.exchangeCodeAsync(
        {
          clientId,
          code,
          redirectUri,
          extraParams: {
            code_verifier: authRequest.codeVerifier ?? '',
          },
        },
        discovery
      )
      await setTokens(tokens)
      await getUser()
    } catch (err) {
      console.log('ErrLogin:', err)
    } finally {
      setLoading(false)
    }
  }
  const getToken = async (): Promise<string> => {
    try {
      const tokens = cachedTokens || await getTokens()
      if (!tokens.refreshToken) {
        return ''
      }

      const refresh = await shouldRefresh(tokens)
      if (!refresh) {
        setAccessToken(tokens.accessToken)
        setCachedTokens(tokens)
        return tokens.accessToken
      }

      const newTokens = await AuthSession.refreshAsync(
        {
          clientId,
          refreshToken: tokens.refreshToken,
        },
        discovery
      )

      // TODO: remove after propel fixes the api response
      if (typeof (newTokens.accessToken as any)?.access_token === 'string') {
        newTokens.accessToken = (newTokens.accessToken as any).access_token
      }

      await setTokens(newTokens)

      setAccessToken(newTokens.accessToken)
      setCachedTokens({
        refreshToken: newTokens.refreshToken ?? '',
        accessToken: newTokens.accessToken ?? '',
        issuedAt: Number(newTokens.issuedAt ?? '0'),
        expiresIn: Number(newTokens.expiresIn ?? '0')
      })
      return newTokens.accessToken
    } catch (err) {
      console.log('ErrGetToken:', err)
    }

    return ''
  }
  const getUser = async (): Promise<User | null> => {
    try {
      const accessToken = await getToken()
      const resp = await AuthSession.fetchUserInfoAsync({ accessToken }, discovery)
      const user = resp as User
      setUser(user)
      return user
    } catch (err) {
      console.log('ErrGetUser:', err)
    }

    return null
  }

  const logout = async (): Promise<void> => {
    try {
      const { refreshToken } = cachedTokens || await getTokens()

      if (refreshToken) {
        const resp = await fetch(`${authUrl}/api/backend/v1/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            refresh_token: refreshToken,
          }),
        })

        if (resp.status !== 200) {
          throw new Error(await resp.text())
        }
      }
    } catch (err) {
      console.log('ErrLogout:', err)
    } finally {
      setUser(null)
      setAccessToken('')
      await removeTokens()
    }
  }

  const getAccountPageUrl = (options: AccountPageUrlOptions) => {
    const url = `${authUrl}/account`
    const qs = new URLSearchParams()

    if (options.redirectUriType === 'custom' && options.redirectUri) {
      qs.set('rt', base64.encode(options.redirectUri))
      return `${url}?${qs.toString()}`
    } else if (options.redirectUriType === 'default') {
      qs.set('rt', base64.encode(redirectUri))
      return `${url}?${qs.toString()}`
    }

    return url
  }

  useEffect(() => {
    getToken()
      .then(async (token) => {
        if (token) {
          await getUser()
        }
      })
      .catch(err => {
        console.log('ErrDidMount:', err)
      })
      .finally(() => {
        setReady(true)
      })
  }, []) // componentDidMount. no dependencies needed

  return (
    <AuthContext.Provider
      value={{ ready, loading, accessToken, user, login, logout, getToken, getUser, getAccountPageUrl }}
    >
      {ready && children}
    </AuthContext.Provider>
  )
}

export type Props = {
  children: ReactNode
  config: PropelAuthConfig
}

const AuthContext = createContext<AuthContextType<User>>({
  ready: false,
  loading: false,
  accessToken: '',
  user: null,
  login: async () => {
    // noop
  },
  logout: async () => {
    // noop
  },
  getToken: () => Promise.resolve(''),
  getUser: () => Promise.resolve(null),
  getAccountPageUrl: (_options: AccountPageUrlOptions) => '',
})

export type User = {
  can_create_orgs: boolean
  created_at: number
  email: string
  email_confirmed: boolean
  enabled: boolean
  has_password: boolean
  last_active_at: number
  locked: boolean
  metadata: unknown
  mfa_enabled: boolean
  picture_url: string
  properties: unknown
  update_password_required: boolean
  user_id: string
}

const removeTokens = async (): Promise<void> => {
  await Promise.all([
    AsyncStorage.removeItem(REFRESH_TOKEN),
    AsyncStorage.removeItem(ACCESS_TOKEN),
    AsyncStorage.removeItem(ACCESS_TOKEN_ISSUED_AT),
    AsyncStorage.removeItem(ACCESS_TOKEN_EXPIRES_IN),
  ])
}

const setTokens = async (tokens: AuthSession.TokenResponse): Promise<void> => {
  const promises = [
    AsyncStorage.setItem(ACCESS_TOKEN, String(tokens.accessToken)),
    AsyncStorage.setItem(ACCESS_TOKEN_ISSUED_AT, String(tokens.issuedAt)),
  ]

  if (typeof tokens.expiresIn === 'number') {
    promises.push(AsyncStorage.setItem(ACCESS_TOKEN_EXPIRES_IN, String(tokens.expiresIn)))
  }

  if (typeof tokens.refreshToken === 'string') {
    promises.push(AsyncStorage.setItem(REFRESH_TOKEN, String(tokens.refreshToken)))
  }

  await Promise.all(promises)
}
const getTokens = async (): Promise<SavedTokens> => {
  try {
    const [refreshToken, accessToken, issuedAt, expiresIn] = await Promise.all([
      AsyncStorage.getItem(REFRESH_TOKEN),
      AsyncStorage.getItem(ACCESS_TOKEN),
      AsyncStorage.getItem(ACCESS_TOKEN_ISSUED_AT),
      AsyncStorage.getItem(ACCESS_TOKEN_EXPIRES_IN)
    ])

    return {
      refreshToken: String(refreshToken ?? ''),
      accessToken: String(accessToken ?? ''),
      issuedAt: Number(issuedAt ?? '0'),
      expiresIn: Number(expiresIn ?? '0')
    }
  } catch (err) {
    console.log('ErrGetTokens:', err)

    return {
      refreshToken: '',
      accessToken: '',
      issuedAt: 0,
      expiresIn: 0
    }
  }
}

const shouldRefresh = async (tokens?: SavedTokens): Promise<boolean> => {
  const t = tokens ?? (await getTokens())

  const issuedAt = t.issuedAt * 1000
  const expireTime = issuedAt + REFRESH_IN

  if (!expireTime) return true
  return Date.now() > expireTime
}

export const useAuthContext = () => {
  return useContext(AuthContext)
}
