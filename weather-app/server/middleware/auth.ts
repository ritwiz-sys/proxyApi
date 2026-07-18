import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'

export interface AuthUser {
  id: string
  email: string
  username: string
}

interface AuthTokenPayload {
  userId: string
  email: string
  username: string
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- required to augment Express's own Request type
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const token = header.slice('Bearer '.length)

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthTokenPayload
    req.user = { id: payload.userId, email: payload.email, username: payload.username }
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
