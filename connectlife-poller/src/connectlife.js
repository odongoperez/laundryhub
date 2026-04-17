// ConnectLife API client for LaundryHub
// Reverse-engineered auth flow:
//   1. POST accounts.eu1.gigya.com/accounts.login   -> UID + login_token
//   2. POST accounts.eu1.gigya.com/accounts.getJWT  -> id_token (signed JWT)
//   3. POST oauth.api.connectlife.io/accounts/oauth2/token  -> access_token
//   4. GET  api.connectlife.io/api/v1/appliance  (Authorization: Bearer access_token)
//
// The access_token is a JWT with exp. We cache it and refresh on 401 or ~5min before expiry.

import { request } from 'undici';

// These constants are the ConnectLife EU mobile app credentials. They are
// publicly documented in the reverse-engineering repos referenced in the README
// and are the same for every ConnectLife user.
const GIGYA_API_KEY   = '4_yhTWQmHFLcQDInPO9YQHRg';
const OAUTH_CLIENT_ID     = 'IOS-Home';
const OAUTH_CLIENT_SECRET = '07swfKgvJhC3ydOUS9YV_SwVz0i4LKqlOLGNUukYHVMsJRF1b-iWeUGcNlXyYCeK';
const OAUTH_REDIRECT_URI  = 'https://api.connectlife.io/swagger/oauth2-redirect.html';

const GIGYA_LOGIN_URL  = 'https://accounts.eu1.gigya.com/accounts.login';
const GIGYA_JWT_URL    = 'https://accounts.eu1.gigya.com/accounts.getJWT';
const OAUTH_TOKEN_URL  = 'https://oauth.api.connectlife.io/accounts/oauth2/token';
const APPLIANCES_URL   = 'https://api.connectlife.io/api/v1/appliance';

const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000; // refresh 5 min before expiry

export class ConnectLifeClient {
  constructor({ username, password, logger = console }) {
    this.username = username;
    this.password = password;
    this.log = logger;
    this.accessToken = null;
    this.accessTokenExp = 0;
  }

  async #gigyaLogin() {
    const body = new URLSearchParams({
      loginID: this.username,
      password: this.password,
      APIKey: GIGYA_API_KEY,
      targetEnv: 'mobile',
    });
    const res = await request(GIGYA_LOGIN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await res.body.json();
    if (data.errorCode !== 0) {
      throw new Error(`Gigya login failed (${data.errorCode}): ${data.errorMessage || data.errorDetails || 'unknown'}`);
    }
    return {
      uid: data.UID,
      loginToken: data.sessionInfo?.cookieValue || data.sessionInfo?.login_token,
    };
  }

  async #gigyaGetJWT(loginToken) {
    const body = new URLSearchParams({
      APIKey: GIGYA_API_KEY,
      login_token: loginToken,
      fields: 'country,firstName,lastName,email,nickname',
    });
    const res = await request(GIGYA_JWT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await res.body.json();
    if (data.errorCode !== 0 || !data.id_token) {
      throw new Error(`Gigya JWT fetch failed (${data.errorCode}): ${data.errorMessage || 'no id_token'}`);
    }
    return data.id_token;
  }

  async #exchangeForAccessToken(idToken) {
    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      client_id: OAUTH_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET,
      redirect_uri: OAUTH_REDIRECT_URI,
      assertion: idToken,
    });
    const res = await request(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'accept': 'application/json',
      },
      body: body.toString(),
    });
    const data = await res.body.json();
    if (!data.access_token) {
      throw new Error(`OAuth token exchange failed: ${JSON.stringify(data)}`);
    }
    // Decode JWT exp (no signature verification needed; we trust the issuer)
    const expMs = this.#jwtExp(data.access_token);
    return { accessToken: data.access_token, expMs };
  }

  #jwtExp(jwt) {
    try {
      const [, payloadB64] = jwt.split('.');
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
      if (typeof payload.exp === 'number') return payload.exp * 1000;
    } catch { /* fall through */ }
    return Date.now() + 30 * 60 * 1000; // fallback: assume 30 min
  }

  async ensureToken() {
    if (this.accessToken && Date.now() < this.accessTokenExp - TOKEN_REFRESH_MARGIN_MS) {
      return this.accessToken;
    }
    this.log.info('[ConnectLife] authenticating');
    const { uid, loginToken } = await this.#gigyaLogin();
    if (!loginToken) throw new Error('Gigya login returned no login_token');
    const idToken = await this.#gigyaGetJWT(loginToken);
    const { accessToken, expMs } = await this.#exchangeForAccessToken(idToken);
    this.accessToken = accessToken;
    this.accessTokenExp = expMs;
    this.log.info(`[ConnectLife] authenticated uid=${uid} token_exp=${new Date(expMs).toISOString()}`);
    return accessToken;
  }

  async getAppliances() {
    const token = await this.ensureToken();
    const res = await request(APPLIANCES_URL, {
      method: 'GET',
      headers: {
        'authorization': `Bearer ${token}`,
        'accept': 'application/json',
      },
    });
    if (res.statusCode === 401) {
      // Token rejected — force re-auth once
      this.accessToken = null;
      const retryToken = await this.ensureToken();
      const retry = await request(APPLIANCES_URL, {
        method: 'GET',
        headers: { 'authorization': `Bearer ${retryToken}`, 'accept': 'application/json' },
      });
      if (retry.statusCode !== 200) {
        throw new Error(`Appliances endpoint returned ${retry.statusCode} after re-auth`);
      }
      return retry.body.json();
    }
    if (res.statusCode !== 200) {
      const text = await res.body.text();
      throw new Error(`Appliances endpoint returned ${res.statusCode}: ${text.slice(0, 200)}`);
    }
    return res.body.json();
  }
}
