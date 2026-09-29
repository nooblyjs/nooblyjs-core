/**
 * @fileoverview Trust the operating-system certificate store for outbound TLS.
 *
 * On machines behind a TLS-inspecting proxy (Zscaler, Netskope, corporate
 * firewalls, etc.) HTTPS connections are re-signed with a corporate root CA.
 * That root lives in the OS trust store — so browsers and curl work — but Node
 * ships its own bundled CA set and does NOT consult the OS store by default, so
 * every outbound HTTPS request fails with:
 *
 *   Error: self-signed certificate in certificate chain  (SELF_SIGNED_CERT_IN_CHAIN)
 *
 * This bites any service that talks to an external endpoint — Azure AD
 * (login.microsoftonline.com OpenID metadata), Azure OpenAI, Anthropic, etc.
 *
 * This helper merges the OS trust store into Node's default CA set at runtime,
 * so the corporate root is trusted without launching Node with --use-system-ca
 * or exporting a PEM for NODE_EXTRA_CA_CERTS. It only ADDS to the trusted set —
 * Node's bundled roots and any NODE_EXTRA_CA_CERTS remain trusted — so it never
 * makes a previously-working connection fail.
 *
 * Requires the runtime CA APIs added in Node 22.15 (tls.getCACertificates /
 * tls.setDefaultCACertificates); it is a safe no-op on older runtimes or when
 * the process was already started with --use-system-ca.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const tls = require('node:tls');

/**
 * Merge the OS certificate store into Node's default trusted CA set so outbound
 * TLS trusts a corporate proxy's root CA. Process-global and idempotent; affects
 * all TLS connections opened after it runs, so call it before the first outbound
 * HTTPS request (typically at the top of an entry-point script).
 *
 * @return {{applied: boolean, reason: string, systemCount?: number}} Result of
 *   the attempt. `applied` is true only when the system store was merged in.
 *
 * @example
 * const { trustSystemCa } = require('../../../src/shared/utils/trustSystemCa');
 * trustSystemCa();
 */
function trustSystemCa() {
  // Older Node (< 22.15) lacks the runtime CA APIs; nothing we can do in-process.
  if (typeof tls.getCACertificates !== 'function'
    || typeof tls.setDefaultCACertificates !== 'function') {
    return { applied: false, reason: 'tls system-CA API unavailable (Node < 22.15)' };
  }

  // If the process was launched with --use-system-ca, the OS store is already in
  // Node's defaults — merging again would be redundant work.
  const usingSystemCaFlag = process.execArgv.includes('--use-system-ca')
    || (process.env.NODE_OPTIONS || '').includes('--use-system-ca');
  if (usingSystemCaFlag) {
    return { applied: false, reason: 'already using --use-system-ca' };
  }

  try {
    const system = tls.getCACertificates('system');
    if (!system || system.length === 0) {
      return { applied: false, reason: 'no system certificates found' };
    }

    // Union of Node's current defaults (bundled roots + any NODE_EXTRA_CA_CERTS)
    // with the OS store. A Set de-duplicates identical PEM strings.
    const merged = new Set([...tls.getCACertificates('default'), ...system]);
    tls.setDefaultCACertificates([...merged]);

    return {
      applied: true,
      reason: 'merged OS certificate store into Node defaults',
      systemCount: system.length
    };
  } catch (err) {
    return { applied: false, reason: `failed: ${err.message}` };
  }
}

module.exports = { trustSystemCa };
