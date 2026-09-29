'use strict';

/**
 * @fileoverview Regression tests for P0-4 — SSRF guard in the fetching service.
 */

const {
  assertUrlAllowed,
  isPrivateIPv4,
  isPrivateIPv6
} = require('../../../src/fetching/modules/ssrfGuard');

describe('P0-4 — SSRF guard', () => {
  describe('private IPv4 detection', () => {
    it.each([
      '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255',
      '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1'
    ])('flags %s as private', (ip) => {
      expect(isPrivateIPv4(ip)).toBe(true);
    });

    it.each(['8.8.8.8', '1.1.1.1', '93.184.216.34'])('allows public %s', (ip) => {
      expect(isPrivateIPv4(ip)).toBe(false);
    });
  });

  describe('private IPv6 detection', () => {
    it.each(['::1', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:127.0.0.1'])(
      'flags %s as private',
      (ip) => {
        expect(isPrivateIPv6(ip)).toBe(true);
      }
    );
  });

  describe('assertUrlAllowed', () => {
    it('rejects non-http(s) schemes', async () => {
      await expect(assertUrlAllowed('file:///etc/passwd')).rejects.toThrow(/protocol/);
      await expect(assertUrlAllowed('gopher://x')).rejects.toThrow(/protocol/);
    });

    it('rejects the cloud metadata IP', async () => {
      await expect(assertUrlAllowed('http://169.254.169.254/latest/meta-data/'))
        .rejects.toThrow(/private\/reserved/);
    });

    it('rejects loopback and private literals', async () => {
      await expect(assertUrlAllowed('http://127.0.0.1:8080/admin')).rejects.toThrow();
      await expect(assertUrlAllowed('http://10.0.0.5/')).rejects.toThrow();
      await expect(assertUrlAllowed('http://[::1]/')).rejects.toThrow();
    });

    it('rejects malformed URLs', async () => {
      await expect(assertUrlAllowed('not a url')).rejects.toThrow();
      await expect(assertUrlAllowed('')).rejects.toThrow();
    });

    it('allows a public IP literal', async () => {
      await expect(assertUrlAllowed('http://8.8.8.8/')).resolves.toBeInstanceOf(URL);
    });

    it('honours an explicit host allow-list (overrides IP checks)', async () => {
      await expect(
        assertUrlAllowed('http://127.0.0.1/', { allowedHosts: ['127.0.0.1'] })
      ).resolves.toBeInstanceOf(URL);
      await expect(
        assertUrlAllowed('http://evil.example/', { allowedHosts: ['good.example'] })
      ).rejects.toThrow(/allow-list/);
    });

    it('can be relaxed for trusted internal fetching', async () => {
      await expect(
        assertUrlAllowed('http://10.0.0.5/', { allowPrivateNetworks: true })
      ).resolves.toBeInstanceOf(URL);
    });
  });
});
