import { makeRedirectUri } from "expo-auth-session"
import type { PropelAuthConfig } from "./wrappers/PropelAuthProvider"

const preparePropelAuthConfig = (
  clientId: string,
  authUrl: string,
  scheme = "minimalauth"
): PropelAuthConfig => {
  return {
    clientId,
    authUrl,
    redirectUri: makeRedirectUri({ scheme }),
    discovery: {
      authorizationEndpoint: `${authUrl}/propelauth/oauth/authorize`,
      tokenEndpoint: `${authUrl}/propelauth/oauth/token`,
      userInfoEndpoint: `${authUrl}/propelauth/oauth/userinfo`,
    },
  }
}

export const Config = {
  propelAuth: preparePropelAuthConfig(
    "client_id",
    "auth_url"
  ),
}