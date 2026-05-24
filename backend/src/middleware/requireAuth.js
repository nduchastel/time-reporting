// backend/src/middleware/requireAuth.js
import { verifyToken } from '../services/authService.js';

export function requireAuth(allowedRoles = ['worker', 'manager', 'admin']) {
  return (req, res, next) => {
    const header = req.get('authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing token' });
    }
    try {
      const payload = verifyToken(match[1]);
      if (!allowedRoles.includes(payload.role)) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Role not allowed' });
      }
      req.user = payload; // { sub, role }
      next();
    } catch (e) {
      return res.status(401).json({ error: 'INVALID_TOKEN', message: e.message });
    }
  };
}
