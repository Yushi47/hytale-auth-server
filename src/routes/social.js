const storage = require('../services/storage');
const { sendJson, sendNoContent } = require('../utils/response');

const DEFAULT_PRESENCE_SETTINGS = {
  allowFriendRequests: true,
  allowInvites: 1,
  allowJoin: true,
  showActivity: 1,
  showLocation: 1,
  showOnline: 1,
};

function mergePresenceSettings(body) {
  const settings = { ...DEFAULT_PRESENCE_SETTINGS };
  for (const key of Object.keys(DEFAULT_PRESENCE_SETTINGS)) {
    if (body[key] !== undefined) {
      settings[key] = body[key];
    }
  }
  return settings;
}

async function handleSocialRoutes(req, res, urlPath, body, uuid) {
  if (urlPath.startsWith('/me/interactions')) {
    sendJson(res, 501, {
      error: 'Observed response shape for /me/interactions is not available',
    });
    return true;
  }

  if (urlPath === '/party/invites' && req.method === 'GET') {
    sendJson(res, 200, { invites: [] });
    return true;
  }

  if (urlPath === '/party/invites/sent' && req.method === 'GET') {
    sendJson(res, 200, { invites: [] });
    return true;
  }

  if (urlPath === '/party' && req.method === 'GET') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not in a party');
    return true;
  }

  if (urlPath === '/world-invites' && req.method === 'GET') {
    sendJson(res, 200, { invites: [] });
    return true;
  }

  if (urlPath === '/world-invites/sent' && req.method === 'GET') {
    sendJson(res, 200, { invites: [] });
    return true;
  }

  if (urlPath === '/friends' && req.method === 'GET') {
    sendJson(res, 200, { friends: [], truncated: false });
    return true;
  }

  if (urlPath === '/friends/favorites' && req.method === 'GET') {
    sendJson(res, 200, { favorites: [] });
    return true;
  }

  if (urlPath === '/presence/friends' && req.method === 'GET') {
    sendJson(res, 200, { friends: [] });
    return true;
  }

  if (urlPath === '/friend-requests/outgoing' && req.method === 'GET') {
    sendJson(res, 200, { requests: [], truncated: false });
    return true;
  }

  if (urlPath === '/friend-requests/incoming' && req.method === 'GET') {
    sendJson(res, 200, { requests: [], truncated: false });
    return true;
  }

  if (urlPath === '/friend-requests/by-username' && req.method === 'POST') {
    const targetUsername = body.targetUsername || '';
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`resolve username "${targetUsername}": player not found`);
    return true;
  }

  if (urlPath === '/blocks' && req.method === 'GET') {
    sendJson(res, 200, { blocks: [], truncated: false });
    return true;
  }

  if (urlPath === '/presence/settings' && req.method === 'GET') {
    const savedSettings = await storage.getPresenceSettings(uuid);
    sendJson(res, 200, savedSettings || DEFAULT_PRESENCE_SETTINGS);
    return true;
  }

  if (urlPath === '/presence/settings' && req.method === 'PUT') {
    await storage.savePresenceSettings(uuid, mergePresenceSettings(body || {}));
    sendNoContent(res);
    return true;
  }

  if (urlPath === '/presence/heartbeat' && req.method === 'POST') {
    await storage.savePresenceHeartbeat(uuid, {
      status: body.status,
      activity: body.activity,
    });
    sendNoContent(res);
    return true;
  }

  return false;
}

module.exports = {
  handleSocialRoutes,
  DEFAULT_PRESENCE_SETTINGS,
};
