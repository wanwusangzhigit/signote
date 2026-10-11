// src/index.js
// Entry point: route requests to handlers.

import { DB } from './db.js';
import { clientIp, enforceIpBan } from './middleware.js';
import { handleHome } from './routes/home.js';
import {
  handleNotePage,
  handleNoteContent,
  handleNoteSave,
  handleNoteRaw,
  handleNoteImg,
  handleNotePut,
  handleNoteDl,
} from './routes/note.js';
import {
  handleAdminPage,
  handleAdminLogin,
  handleAdminLogout,
  handleAdminListNotes,
  handleAdminGetNote,
  handleAdminUpdateNote,
  handleAdminDeleteNotes,
  handleAdminGetSettings,
  handleAdminSetSettings,
  handleAdminListIps,
  handleAdminBanIp,
  handleAdminUnbanIp,
  handleAdminListLogs,
} from './routes/admin.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Favicon: serve a lightweight inline SVG.
    if (path === '/favicon.ico' || path === '/favicon.svg') {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#1a1a1a"/><rect x="9" y="7" width="14" height="18" rx="2" stroke="#fff" stroke-width="1.5" fill="none"/><path d="M12 12h8M12 16h8M12 20h5" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>`;
      return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
    }

    // IP-ban enforcement. Admin paths are exempt so an admin can never lock
    // themselves out of the panel (they can unban from there).
    const isAdminPath = path === '/admin' || path.startsWith('/admin/');
    if (!isAdminPath) {
      const ip = clientIp(request);
      const db = new DB(env.DB);
      const banned = await enforceIpBan(db, ip);
      if (banned) return banned;
    }

    try {
      // ---- home ----
      if (path === '/') {
        if (method === 'GET') return handleHome(env, request);
        return methodNotAllowed();
      }

      // ---- admin ----
      if (path === '/admin' || path.startsWith('/admin/')) {
        return routeAdmin(request, env, path, method);
      }

      // ---- notes ----
      return routeNote(request, env, path, method);
    } catch (err) {
      console.error('request error', err);
      return new Response('Internal server error', { status: 500 });
    }
  },
};

function methodNotAllowed() {
  return new Response('Method not allowed', { status: 405 });
}

function routeAdmin(req, env, path, method) {
  if (path === '/admin') {
    if (method === 'GET') return handleAdminPage(env, req);
    return methodNotAllowed();
  }
  if (path === '/admin/login') {
    if (method === 'POST') return handleAdminLogin(env, req);
    return methodNotAllowed();
  }
  if (path === '/admin/logout') {
    if (method === 'POST') return handleAdminLogout();
    return methodNotAllowed();
  }
  if (path === '/admin/api/notes') {
    if (method === 'GET') return handleAdminListNotes(env, req);
    return methodNotAllowed();
  }
  if (path === '/admin/api/notes/delete') {
    if (method === 'POST') return handleAdminDeleteNotes(env, req);
    return methodNotAllowed();
  }
  // /admin/api/notes/:id and /admin/api/notes/:id/update
  if (path.startsWith('/admin/api/notes/')) {
    const parts = path.split('/').filter(Boolean); // ['admin','api','notes',id,...]
    const noteId = parts[3] ? decodeURIComponent(parts[3]).toLowerCase() : '';
    if (parts.length === 4) {
      if (method === 'GET') return handleAdminGetNote(env, req, noteId);
      return methodNotAllowed();
    }
    if (parts.length === 5 && parts[4] === 'update') {
      if (method === 'POST') return handleAdminUpdateNote(env, req, noteId);
      return methodNotAllowed();
    }
  }
  if (path === '/admin/api/settings') {
    if (method === 'GET') return handleAdminGetSettings(env, req);
    if (method === 'POST') return handleAdminSetSettings(env, req);
    return methodNotAllowed();
  }
  if (path === '/admin/api/ips') {
    if (method === 'GET') return handleAdminListIps(env, req);
    return methodNotAllowed();
  }
  if (path === '/admin/api/ips/ban') {
    if (method === 'POST') return handleAdminBanIp(env, req);
    return methodNotAllowed();
  }
  if (path === '/admin/api/ips/unban') {
    if (method === 'POST') return handleAdminUnbanIp(env, req);
    return methodNotAllowed();
  }
  if (path === '/admin/api/logs') {
    if (method === 'GET') return handleAdminListLogs(env, req);
    return methodNotAllowed();
  }
  return new Response('Not found', { status: 404 });
}

function routeNote(req, env, path, method) {
  // path: /<id> or /<id>/<action>
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return new Response('Not found', { status: 404 });
  let id;
  try {
    id = decodeURIComponent(segments[0]);
  } catch {
    return new Response('Invalid note id.', { status: 400 });
  }
  // Case-insensitive IDs: normalize to lowercase.
  id = id.toLowerCase();
  const action = segments[1];

  // /:id
  if (!action) {
    if (method === 'GET') return handleNotePage(env, req, id);
    if (method === 'POST') return handleNoteSave(env, req, id);
    return methodNotAllowed();
  }

  // /:id/content
  if (action === 'content') {
    if (method === 'GET') return handleNoteContent(env, req, id);
    return methodNotAllowed();
  }
  // /:id/raw
  if (action === 'raw') {
    if (method === 'GET') return handleNoteRaw(env, req, id);
    return methodNotAllowed();
  }
  // /:id/img
  if (action === 'img') {
    if (method === 'GET') return handleNoteImg(env, req, id);
    return methodNotAllowed();
  }
  // /:id/dl — download content as a file (uses the note's filename if set)
  if (action === 'dl') {
    if (method === 'GET') return handleNoteDl(env, req, id);
    return methodNotAllowed();
  }
  // /:id/put
  if (action === 'put') {
    if (method === 'PUT' || method === 'POST') return handleNotePut(env, req, id);
    return methodNotAllowed();
  }

  return new Response('Not found', { status: 404 });
}
