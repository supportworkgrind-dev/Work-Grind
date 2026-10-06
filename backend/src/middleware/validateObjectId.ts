import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

/**
 * validateObjectId — middleware to validate MongoDB ObjectId path parameters.
 *
 * Usage: router.get('/:id', validateObjectId('id'), myController)
 *
 * Without this guard, passing a non-ObjectId string (e.g. "undefined", "null",
 * or 24-char strings that aren't valid hex) causes Mongoose to throw a
 * CastError which leaks the internal field name and type info in the 500
 * response. Validating upfront returns a clean 400 instead.
 */
export const validateObjectId = (...paramNames: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    for (const param of paramNames) {
      const value = req.params[param];
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        res.status(400).json({
          success: false,
          message: `Invalid identifier: ${param}`,
        });
        return;
      }
    }
    next();
  };
