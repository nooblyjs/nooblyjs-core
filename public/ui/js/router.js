// Routing helpers (structure.md §2a), pure so they can be tested without a browser: which app owns a URL (the
// longest mount path), which of its routes matches, and where its module lives.

/** '/runs/:id' → { regexp, keys }. A trailing slash is optional; params are URL-decoded when matched. */
export function compile(pattern) {
  const keys = [];
  const parts = String(pattern).split('/').filter(Boolean).map((part) => {
    if (part.startsWith(':')) {
      keys.push(part.slice(1));
      return '([^/]+)';
    }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  return { regexp: new RegExp(`^/${parts.join('/')}/?$`, 'i'), keys };
}

/** The first route whose path matches `path` (relative to the app's mount path), with its params. */
export function matchRoute(routes, path) {
  for (const route of routes ?? []) {
    route._compiled ??= compile(route.path);
    const m = route._compiled.regexp.exec(path);
    if (!m) continue;
    const params = {};
    route._compiled.keys.forEach((key, i) => {
      try {
        params[key] = decodeURIComponent(m[i + 1]);
      } catch {
        params[key] = m[i + 1];
      }
    });
    return { route, params };
  }
  return null;
}

/** True when `pathname` is under `mountPath` ('/' owns everything). */
export const isUnder = (mountPath, pathname) => mountPath === '/' || pathname === mountPath || pathname.startsWith(`${mountPath}/`);

/** The app whose mount path is the longest prefix of `pathname`. */
export function appFor(apps, pathname) {
  return [...apps].filter((a) => isUnder(a.mountPath, pathname)).sort((a, b) => b.mountPath.length - a.mountPath.length)[0] ?? null;
}

/** `pathname` relative to the mount path, always starting with '/'. */
export function relativePath(mountPath, pathname) {
  if (mountPath === '/') return pathname || '/';
  const rest = pathname.slice(mountPath.length);
  return rest.startsWith('/') ? rest : `/${rest}`;
}

/** An app-relative path ('/runs/214') as a full path under the mount path. */
export const fullPath = (mountPath, path) => (mountPath === '/' ? path : `${mountPath}${path === '/' ? '' : path}`) || '/';

/** Where a module or stylesheet lives: absolute entries stay; relative ones are under the mount path. */
export const resolveAsset = (mountPath, entry) => (entry.startsWith('/') ? entry : `${mountPath === '/' ? '' : mountPath}/${entry}`);
