/**
 * @fileoverview Where to send someone after a successful sign-in.
 *
 * The page they were heading to (the request's returnUrl) wins, then the app's configured
 * loginSuccessRedirectUrl, then the given default. A returnUrl is only used when it is a same-origin
 * relative path, so a crafted ?returnUrl= cannot turn the post-login redirect into an open redirect.
 *
 * @since 1.0.12
 */

'use strict';

/**
 * Returns `url` when it is a same-origin relative path ('/x', not '//host' or '/\host'), otherwise null.
 * @param {*} url The candidate return URL.
 * @return {?string}
 */
function safeReturnUrl(url) {
  if (typeof url !== 'string' || url.length === 0 || url.length > 2048) return null;
  if (url[0] !== '/' || url[1] === '/' || url[1] === '\\') return null;
  return url;
}

/**
 * The post-login destination: a safe returnUrl, else the app's loginSuccessRedirectUrl, else `fallback`.
 * @param {*} returnUrl The page the person was heading to, if any.
 * @param {Object=} options The authservice options (loginSuccessRedirectUrl).
 * @param {?string=} fallback Used when neither is set ('/services' by default).
 * @return {?string}
 */
function postLoginRedirect(returnUrl, options = {}, fallback = '/services') {
  return safeReturnUrl(returnUrl) || options.loginSuccessRedirectUrl || fallback;
}

module.exports = { safeReturnUrl, postLoginRedirect };
