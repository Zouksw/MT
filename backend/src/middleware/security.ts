/**
 * Security middleware
 * Provides HTTP security headers and CORS configuration
 */

import helmet from 'helmet';
import type { Request, Response, NextFunction } from 'express';
import { ZodError, z } from 'zod';

/**
 * Security headers middleware using Helmet
 */
export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  // HTTP Strict Transport Security (only in production)
  hsts: process.env.NODE_ENV === 'production'
    ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      }
    : false,
  // Prevent clickjacking
  frameguard: { action: 'deny' },
  // X-XSS Protection
  xssFilter: true,
  // Prevent MIME type sniffing
  noSniff: true,
  // Referrer-Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // Disable X-Powered-By header
  hidePoweredBy: true,
});

/**
 * Input validation middleware factory
 * Uses Zod schemas to validate request data
 */
export const validate =
  (schema: z.ZodSchema, property: 'body' | 'query' | 'params' = 'body') =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      req[property] = await schema.parseAsync(req[property]);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

/**
 * SQL injection detection middleware
 * Basic detection for common SQL injection patterns
 */
export const detectSqlInjection = (req: Request, res: Response, next: NextFunction) => {
  const sqlInjectionPatterns = [
    /(%27)|(')|(--)|(%23)|(#)/i,
    // OR/AND followed by = (potential tautology attack) but exclude safe patterns
    /(\bor\b|\band\b)(?!.*(?:select|from|where|group|order|having|limit)).*?=/i,
    /exec(\s|\+)+(s|x)p\w+/i,
    /union(\s|\+).*?select/i,
    // Remove generic SELECT...FROM as legitimate queries need it
    // Focus on dangerous patterns instead
    /insert(\s|\+).*?into/i,
    /delete(\s|\+).*?from/i,
    /drop(\s|\+).*?table/i,
    /truncate(\s|\+).*?table/i,
    /update(\s|\+).*?set/i,
    /create(\s|\+).*?table/i,
    /alter(\s|\+).*?table/i,
  ];

  const checkString = (str: string): boolean => {
    return sqlInjectionPatterns.some(pattern => pattern.test(str));
  };

  const checkObject = (obj: any): boolean => {
    if (!obj || typeof obj !== 'object') return false;
    for (const value of Object.values(obj)) {
      if (typeof value === 'string' && checkString(value)) {
        return true;
      }
      if (typeof value === 'object' && checkObject(value)) {
        return true;
      }
    }
    return false;
  };

  // Check query parameters
  if (checkObject(req.query)) {
    return res.status(400).json({
      error: 'Invalid input detected',
      message: 'Potential SQL injection pattern found in query parameters',
    });
  }

  // Check request body
  if (checkObject(req.body)) {
    return res.status(400).json({
      error: 'Invalid input detected',
      message: 'Potential SQL injection pattern found in request body',
    });
  }

  next();
};

/**
 * XSS detection middleware
 * Enhanced detection for common XSS patterns and attack vectors
 */
export const detectXSS = (req: Request, res: Response, next: NextFunction) => {
  // Comprehensive XSS attack patterns
  const xssPatterns = [
    // Script and iframe tags
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,

    // JavaScript protocols
    /javascript:/gi,
    /vbscript:/gi,
    /data:\s*text\/html/gi,

    // Event handlers (common XSS vectors)
    /on\w+\s*=/gi, // onclick, onload, onerror, etc.
    /onfocus\s*=/gi,
    /onblur\s*=/gi,
    /onmouseover\s*=/gi,
    /onmouseout\s*=/gi,
    /onmouseenter\s*=/gi,
    /onmouseleave\s*=/gi,
    /onkeydown\s*=/gi,
    /onkeyup\s*=/gi,
    /onkeypress\s*=/gi,

    // Dangerous HTML tags
    /<object\b[^>]*>/gi,
    /<embed\b[^>]*>/gi,
    /<link\b[^>]*>/gi,
    /<meta\b[^>]*>/gi,
    /<style\b[^>]*>/gi,
    /<base\b[^>]*>/gi,

    // SVG-based XSS
    /<svg[^>]*>.*?<script\b[^>]*>/gi,
    /<svg[^>]*>.*?on\w+\s*=/gi,

    // Expression and eval (older IE)
    /expression\s*\(/gi,
    /eval\s*\(/gi,
    /<\s*!\[CDATA\[/gi,

    // Common XSS payload patterns
    /fromCharCode/gi,
    /&#\d+;/gi, // HTML entity encoding
    /&#x[\da-f]+;/gi, // Hex HTML entities
    /%3Cscript/gi, // URL encoded script tag
    /%3E/gi, // URL encoded >
    /%2F/gi, // URL encoded /

    // IMG tag XSS vectors
    /<img[^>]+src[^>]*javascript:/gi,
    /<img[^>]+onerror[^>]*>/gi,

    // Input-based XSS
    /<input[^>]+onfocus[^>]*>/gi,
    /<input[^>]+onblur[^>]*>/gi,
    /<input[^>]+onchange[^>]*>/gi,

    // Form-based XSS
    /<form[^>]+onsubmit[^>]*>/gi,
    /<form[^>]+action[^>]*javascript:/gi,

    // Meta refresh XSS
    /<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*url/gi,

    // Link-based XSS
    /<link\b[^>]*rel\s*=\s*["']?stylesheet["']?[^>]*href[^>]*javascript:/gi,

    // @import in style (CSS-based XSS)
    /@import\s+url\s*\(/gi,

    // Behavior attribute (IE-specific)
    /behavior\s*:/gi,

    // Background image with javascript
    /background\s*:\s*url\s*\(\s*javascript:/gi,
  ];

  const checkString = (str: string): boolean => {
    return xssPatterns.some(pattern => pattern.test(str));
  };

  const checkObject = (obj: any): boolean => {
    if (!obj || typeof obj !== 'object') return false;
    for (const value of Object.values(obj)) {
      if (typeof value === 'string' && checkString(value)) {
        return true;
      }
      if (typeof value === 'object' && checkObject(value)) {
        return true;
      }
    }
    return false;
  };

  // Check query parameters and body
  if (checkObject(req.query) || checkObject(req.body)) {
    return res.status(400).json({
      error: 'Invalid input detected',
      message: 'Potential XSS pattern found in request',
    });
  }

  next();
};

/**
 * Request size limiter
 * Prevents large payload attacks
 */
export const limitRequestSize = (maxSize: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const maxSizeInBytes = parseSize(maxSize);

    if (contentLength > maxSizeInBytes) {
      return res.status(413).json({
        error: 'Payload too large',
        message: `Request body exceeds maximum size of ${maxSize}`,
      });
    }
    next();
  };
};

/**
 * Parse size string (e.g., '10mb') to bytes
 */
function parseSize(size: string): number {
  const units: { [key: string]: number } = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?$/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';

  return value * (units[unit] || 1);
}

/**
 * Sanitize HTML input
 * Removes potentially dangerous HTML tags
 */
export const sanitizeHtml = (input: string): string => {
  if (!input || typeof input !== 'string') return input;

  // Remove script tags and their content
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove iframe tags and their content
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

  // Remove event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');

  return sanitized;
};

/**
 * Validation schemas for common inputs
 */
export const validationSchemas = {
  // Email validation
  email: z.string().email('Invalid email format'),
  emailOptional: z.string().email('Invalid email format').optional(),

  // Password validation (at least 8 characters, 1 uppercase, 1 lowercase, 1 number)
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),

  // UUID validation
  uuid: z.string().uuid('Invalid UUID format'),

  // Timeseries name validation
  timeseriesName: z
    .string()
    .min(1, 'Timeseries name is required')
    .max(255, 'Timeseries name must be less than 255 characters')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Timeseries name can only contain letters, numbers, dots, underscores, and hyphens'),

  // Pagination parameters
  pagination: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
  }),

  // SQL query validation (basic)
  sqlQuery: z
    .string()
    .max(10000, 'Query too long')
    .refine(
      (query) => {
        const forbidden = ['DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'CREATE', 'INSERT', 'UPDATE'];
        const upperQuery = query.toUpperCase();
        return !forbidden.some(word => upperQuery.includes(word));
      },
      'Only SELECT queries are allowed'
    ),
};
