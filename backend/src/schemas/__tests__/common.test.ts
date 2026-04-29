import { describe, test, expect } from 'vitest';
import {
  paginationSchema,
  limitSchema,
  getPagination,
  type PaginationParams,
} from '@/schemas/common';

describe('Common Schemas', () => {
  describe('paginationSchema', () => {
    test('should accept valid pagination params', () => {
      const result = paginationSchema.parse({
        page: '1',
        limit: '20',
      });
      expect(result).toEqual({ page: 1, limit: 20 });
    });

    test('should coerce strings to numbers', () => {
      const result = paginationSchema.parse({
        page: '2',
        limit: '50',
      });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
    });

    test('should use default values when not provided', () => {
      const result = paginationSchema.parse({});
      expect(result).toEqual({ page: 1, limit: 20 });
    });

    test('should accept partial params with defaults', () => {
      const result1 = paginationSchema.parse({ page: '3' });
      expect(result1).toEqual({ page: 3, limit: 20 });

      const result2 = paginationSchema.parse({ limit: '50' });
      expect(result2).toEqual({ page: 1, limit: 50 });
    });

    test('should reject negative page', () => {
      expect(() => paginationSchema.parse({ page: '-1' })).toThrow();
    });

    test('should reject zero page', () => {
      expect(() => paginationSchema.parse({ page: '0' })).toThrow();
    });

    test('should reject non-integer page', () => {
      expect(() => paginationSchema.parse({ page: '1.5' })).toThrow();
    });

    test('should reject limit over 1000', () => {
      expect(() => paginationSchema.parse({ limit: '1001' })).toThrow();
    });

    test('should accept max limit of 1000', () => {
      const result = paginationSchema.parse({ limit: '1000' });
      expect(result.limit).toBe(1000);
    });

    test('should reject non-numeric strings', () => {
      expect(() => paginationSchema.parse({ page: 'abc' })).toThrow();
      expect(() => paginationSchema.parse({ limit: 'xyz' })).toThrow();
    });
  });

  describe('limitSchema', () => {
    test('should accept valid limit', () => {
      const result = limitSchema.parse({ limit: '100' });
      expect(result.limit).toBe(100);
    });

    test('should use default limit when not provided', () => {
      const result = limitSchema.parse({});
      expect(result.limit).toBe(1000);
    });

    test('should coerce string to number', () => {
      const result = limitSchema.parse({ limit: '500' });
      expect(result.limit).toBe(500);
    });

    test('should reject negative limit', () => {
      expect(() => limitSchema.parse({ limit: '-1' })).toThrow();
    });

    test('should reject zero limit', () => {
      expect(() => limitSchema.parse({ limit: '0' })).toThrow();
    });

    test('should reject limit over 10000', () => {
      expect(() => limitSchema.parse({ limit: '10001' })).toThrow();
    });

    test('should accept max limit of 10000', () => {
      const result = limitSchema.parse({ limit: '10000' });
      expect(result.limit).toBe(10000);
    });
  });

  describe('getPagination', () => {
    test('should calculate skip and take from page 1', () => {
      const result = getPagination({ page: '1', limit: '20' });
      expect(result).toEqual({ skip: 0, take: 20 });
    });

    test('should calculate skip and take from page 2', () => {
      const result = getPagination({ page: '2', limit: '20' });
      expect(result).toEqual({ skip: 20, take: 20 });
    });

    test('should calculate skip and take from page 5', () => {
      const result = getPagination({ page: '5', limit: '10' });
      expect(result).toEqual({ skip: 40, take: 10 });
    });

    test('should use defaults when params not provided', () => {
      const result = getPagination({});
      expect(result).toEqual({ skip: 0, take: 20 });
    });

    test('should handle large page numbers', () => {
      const result = getPagination({ page: '100', limit: '50' });
      expect(result).toEqual({ skip: 4950, take: 50 });
    });

    test('should reject invalid params', () => {
      expect(() => getPagination({ page: '-1' })).toThrow();
      expect(() => getPagination({ limit: '0' })).toThrow();
    });
  });

  describe('PaginationParams type', () => {
    test('should infer correct type from schema', () => {
      const params: PaginationParams = { page: 1, limit: 20 };
      expect(typeof params.page).toBe('number');
      expect(typeof params.limit).toBe('number');
    });
  });
});
