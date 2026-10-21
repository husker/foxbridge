import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  (req as any).requestId = randomUUID();
  next();
}
