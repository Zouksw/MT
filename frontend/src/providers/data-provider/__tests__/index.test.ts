/**
 * Tests for data-provider
 */

import { dataProvider } from '../index';

// Mock axios with factory function
jest.mock('axios', () => {
  const mockAxios = {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return {
    create: jest.fn(() => mockAxios),
  };
});

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(() => null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('dataProvider', () => {
  let mockAxios: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Get mock from axios
    const axios = require('axios');
    mockAxios = axios.create();
  });

  describe('getApiUrl', () => {
    it('should return API URL', () => {
      expect(dataProvider.getApiUrl()).toBe('http://localhost:8000/api');
    });
  });

  describe('getList', () => {
    it('should fetch list with pagination', async () => {
      const mockData = {
        data: [
          { id: '1', name: 'Item 1' },
          { id: '2', name: 'Item 2' },
        ],
        pagination: { total: 2 },
      };
      mockAxios.get.mockResolvedValue({ data: mockData });

      const result = await dataProvider.getList({
        resource: 'test-resource',
        pagination: { current: 1, pageSize: 10 } as any,
      });

      expect(result.data).toEqual(mockData.data);
      expect(result.total).toBe(2);
    });

    it('should handle blog_posts resource format', async () => {
      mockAxios.get.mockResolvedValue({
        data: { blog_posts: [{ id: '1', title: 'Post 1' }], total: 1 },
      });

      const result = await dataProvider.getList({
        resource: 'blog_posts',
        pagination: { current: 1, pageSize: 10 } as any,
      });

      expect(result.data).toEqual([{ id: '1', title: 'Post 1' }]);
      expect(result.total).toBe(1);
    });

    it('should handle categories resource format', async () => {
      mockAxios.get.mockResolvedValue({
        data: { categories: [{ id: '1', name: 'Tech' }], total: 1 },
      });

      const result = await dataProvider.getList({
        resource: 'categories',
        pagination: { current: 1, pageSize: 10 } as any,
      });

      expect(result.data).toEqual([{ id: '1', name: 'Tech' }]);
      expect(result.total).toBe(1);
    });
  });

  describe('getOne', () => {
    it('should fetch single resource by ID', async () => {
      const mockItem = { id: '123', name: 'Test Item' };
      mockAxios.get.mockResolvedValue({ data: { data: mockItem } });

      const result = await dataProvider.getOne({
        resource: 'test-resource',
        id: '123',
      });

      expect(result.data).toEqual(mockItem);
    });
  });

  describe('create', () => {
    it('should create new resource', async () => {
      const newItem = { id: '123', name: 'New Item' };
      const variables = { name: 'New Item', value: 100 };
      mockAxios.post.mockResolvedValue({ data: { data: newItem } });

      const result = await dataProvider.create({
        resource: 'test-resource',
        variables,
      });

      expect(result.data).toEqual(newItem);
    });
  });

  describe('update', () => {
    it('should update resource by ID', async () => {
      const updatedItem = { id: '123', name: 'Updated Item' };
      const variables = { name: 'Updated Item' };
      mockAxios.patch.mockResolvedValue({ data: { data: updatedItem } });

      const result = await dataProvider.update({
        resource: 'test-resource',
        id: '123',
        variables,
      });

      expect(result.data).toEqual(updatedItem);
    });
  });

  describe('deleteOne', () => {
    it('should delete resource by ID', async () => {
      mockAxios.delete.mockResolvedValue({});

      const result = await dataProvider.deleteOne({
        resource: 'test-resource',
        id: '123',
      });

      expect(result.data).toEqual({ id: '123' });
    });
  });

  describe('custom', () => {
    it('should handle custom GET request', async () => {
      const mockData = { result: 'custom data' };
      mockAxios.get.mockResolvedValue({ data: mockData });

      const result = await dataProvider.custom!({
        url: '/custom/endpoint',
        method: 'get',
      });

      expect(result.data).toEqual(mockData);
    });

    it('should handle custom POST request with payload', async () => {
      const mockData = { id: '123', created: true };
      mockAxios.post.mockResolvedValue({ data: mockData });

      const payload = { name: 'Custom', value: 100 };
      const result = await dataProvider.custom!({
        url: '/custom/create',
        method: 'post',
        payload,
      });

      expect(result.data).toEqual(mockData);
    });

    it('should handle custom PATCH request', async () => {
      const mockData = { id: '123', updated: true };
      mockAxios.patch.mockResolvedValue({ data: mockData });

      const result = await dataProvider.custom!({
        url: '/custom/update',
        method: 'patch',
        payload: { value: 200 },
      });

      expect(result.data).toEqual(mockData);
    });

    it('should handle custom PUT request', async () => {
      const mockData = { id: '123', replaced: true };
      mockAxios.put.mockResolvedValue({ data: mockData });

      const result = await dataProvider.custom!({
        url: '/custom/replace',
        method: 'put',
        payload: { name: 'Replaced' },
      });

      expect(result.data).toEqual(mockData);
    });

    it('should handle custom DELETE request', async () => {
      const mockData = { deleted: true };
      mockAxios.delete.mockResolvedValue({ data: mockData });

      const result = await dataProvider.custom!({
        url: '/custom/delete',
        method: 'delete',
      });

      expect(result.data).toEqual(mockData);
    });
  });
});
