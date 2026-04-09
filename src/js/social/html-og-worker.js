// This code does nothing within this project. It is only here to be uploaded to the Cloudflare worker to run my Open Graph (OG) server.

const APP_ORIGIN = 'https://colors.ravgo.dev';
const UPSTREAM_HTML_ORIGIN = 'https://colors.ravgo.dev';
const OG_BASE = 'https://image-og.colors.ravgo.dev';

const VIZ_TYPES = ['geo', 'typo', 'layers', 'gradient'];
const VIZ_MAP = { geo: 'geo', typo: 'type', layers: 'depth', gradient: 'flow' };

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;


    console.log('html-og worker hit:', pathname);

    if (isHtmlRequest(request)) {
      return await handleHtmlRequest(request, pathname, url.search);
    }

    if (isStaticAssetRequest(pathname)) {
      return fetchFromOrigin(request, pathname + url.search);
    }

    return fetchFromOrigin(request, pathname + url.search);
  } catch (error) {
    // Fail open: on worker error, proxy to upstream
    console.error('Worker error:', error);
    return fetchFromOrigin(request, new URL(request.url).pathname + new URL(request.url).search);
  }
}

function isHtmlRequest(request) {
  const accept = request.headers.get('Accept') || '';
  return accept.includes('text/html') || accept.includes('application/xhtml+xml');
}

async function handleHtmlRequest(request, pathname, search) {
  const upstreamUrl = new URL('/' + search, UPSTREAM_HTML_ORIGIN).toString();
  const upstreamResponse = await fetch(upstreamUrl, request);
  if (!upstreamResponse.ok) return upstreamResponse;

  const html = await upstreamResponse.text();

  // Handle root — inject title card meta
  let injectedMeta;
  if (pathname === '/' || pathname === '') {
    injectedMeta = buildRootOGMeta();
  } else {
    injectedMeta = buildOGMetaHtmlFromPath(pathname);
  }

  if (!injectedMeta) {
    return new Response(html, {
      status: upstreamResponse.status,
      headers: filterHtmlHeaders(upstreamResponse.headers),
    });
  }

  const body = html.replace('<!-- OG_META_TAGS -->', injectedMeta);
  return new Response(body, {
    status: upstreamResponse.status,
    headers: filterHtmlHeaders(upstreamResponse.headers),
  });
}

function buildRootOGMeta() {
  const title = 'Color Palette Visualizer';
  const desc = 'Create, explore, and share beautiful color palettes.';
  const ogImageUrl = `${OG_BASE}/`; // hits your title card handler

  const meta = [
    { property: 'og:title', content: title },
    { property: 'og:description', content: desc },
    { property: 'og:url', content: APP_ORIGIN },
    { property: 'og:type', content: 'website' },
    { property: 'og:image', content: ogImageUrl },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:site_name', content: 'Color Palette Visualizer' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: desc },
    { name: 'twitter:image', content: ogImageUrl },
  ];

  return meta.map(entry => {
    const attr = Object.entries(entry)
      .map(([k, v]) => `${k}="${String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"`)
      .join(' ');
    return `<meta ${attr}>`;
  }).join('\n  ');
}

function fetchFromOrigin(request, path) {
  const upstreamUrl = new URL(path, UPSTREAM_HTML_ORIGIN).toString();
  return fetch(upstreamUrl, request);
}

function isStaticAssetRequest(pathname) {
  return pathname.includes('.') || pathname.startsWith('/api/') || pathname.startsWith('/og/');
}

function filterHtmlHeaders(headers) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('content-type', 'text/html;charset=UTF-8');
  responseHeaders.delete('content-security-policy');
  return responseHeaders;
}

function isValidHex(str) {
  return /^[0-9a-fA-F]{6}$/.test(str);
}

function unpackHexes(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const colors = [];
  for (let i = 0; i < binary.length; i += 3) {
    const n = (binary.charCodeAt(i) << 16) |
              (binary.charCodeAt(i + 1) << 8) |
               binary.charCodeAt(i + 2);
    colors.push('#' + n.toString(16).padStart(6, '0'));
  }
  return colors;
}

function decodeMeta(str) {
  try {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(b64);
    return decoded.split('|').map(n => n === '_' ? null : n);
  } catch {
    return [];
  }
}

function parseOGUrl(pathname) {
  const parts = pathname.replace(/^\/+/, '').split('/').filter(Boolean);
  if (!parts.length) return null;

  let vizType = 'palette';
  if (VIZ_TYPES.includes(parts[parts.length - 1])) {
    vizType = VIZ_MAP[parts.pop()];
  }

  let hexPart = '';
  let slug = '';
  if (parts.length === 1) {
    hexPart = parts[0];
  } else if (parts.length >= 2) {
    slug = parts[0];
    hexPart = parts[1];
  } else {
    return null;
  }

  let metaPart = null;
  if (hexPart.includes('~')) {
    [hexPart, metaPart] = hexPart.split('~');
  }

  let isLight = false;
  if (hexPart.endsWith('L')) {
    isLight = true;
    hexPart = hexPart.slice(0, -1);
  } else if (hexPart.endsWith('B')) {
    isLight = false;
    hexPart = hexPart.slice(0, -1);
  }

  let colors;
  const rawHexes = hexPart.split('-').filter(Boolean);
  if (rawHexes.every(isValidHex)) {
    colors = rawHexes.map(h => '#' + h);
  } else {
    try {
      colors = unpackHexes(hexPart);
    } catch {
      return null;
    }
    if (!colors.length || !colors.every(c => isValidHex(c.slice(1)))) return null;
  }

  const names = metaPart ? decodeMeta(metaPart) : colors.map(() => null);
  return {
    colors,
    names,
    slug: slug.replace(/-/g, ' ') || 'untitled',
    isLight,
    vizType,
  };
}

function buildOGMetaHtmlFromPath(pathname) {
  const parsed = parseOGUrl(pathname);
  if (!parsed) {
    return null; // Fail open: don't inject OG meta for invalid URLs
  }
  
  const title = `${parsed.slug} — Color Palette Visualizer`;
  const fullUrl = `${APP_ORIGIN.replace(/\/+$/, '')}${pathname}`;
  const ogImageUrl = `${OG_BASE.replace(/\/+$/, '')}${pathname === '/' ? '/' : pathname}`;
  const imageWidth = '1200';
  const imageHeight = '630';

  const meta = [
    { property: 'og:title', content: title },
    { property: 'og:description', content: 'Create, explore, and share beautiful color palettes.' },
    { property: 'og:url', content: fullUrl },
    { property: 'og:type', content: 'website' },
    { property: 'og:image', content: ogImageUrl },
    { property: 'og:image:width', content: imageWidth },
    { property: 'og:image:height', content: imageHeight },
    { property: 'og:site_name', content: 'Color Palette Visualizer' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: 'Create, explore, and share beautiful color palettes.' },
    { name: 'twitter:image', content: ogImageUrl },
  ];

  return meta.map(entry => {
    const attr = Object.entries(entry)
      .map(([key, value]) => `${key}="${String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}"`)
      .join(' ');
    return `<meta ${attr}>`;
  }).join('\n  ');
}