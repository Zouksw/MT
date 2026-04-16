/**
 * MSW Request Handlers
 *
 * Intercepts HTTP requests during tests and returns mock responses.
 * Covers auth, datasets, alerts, and timeseries API endpoints.
 */

import { http, HttpResponse } from 'msw';

const API_BASE = 'http://localhost:8000/api';

// Test data
export const mockUser = {
  id: 'test-user-1',
  email: 'test@example.com',
  name: 'Test User',
  roles: ['user'],
};

export const mockToken = 'test-jwt-token-12345';

export const handlers = [
  // Auth endpoints
  http.post(`${API_BASE}/auth/login`, async () => {
    return HttpResponse.json({
      user: mockUser,
      token: mockToken,
    });
  }),

  http.post(`${API_BASE}/auth/register`, async () => {
    return HttpResponse.json({
      user: { ...mockUser, id: 'new-user-1' },
      token: 'new-jwt-token',
    }, { status: 201 });
  }),

  http.get(`${API_BASE}/auth/verify`, () => {
    return HttpResponse.json({ valid: true });
  }),

  http.post(`${API_BASE}/auth/logout`, () => {
    return HttpResponse.json({ success: true });
  }),

  // Dataset endpoints
  http.get(`${API_BASE}/datasets`, ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json({
      datasets: [
        { id: 'ds-1', name: 'Temperature Data', slug: 'temperature-data', storageFormat: 'CSV', ownerId: 'test-user-1', createdAt: '2024-01-01T00:00:00Z', _count: { timeseries: 3 } },
        { id: 'ds-2', name: 'Pressure Data', slug: 'pressure-data', storageFormat: 'CSV', ownerId: 'test-user-1', createdAt: '2024-01-02T00:00:00Z', _count: { timeseries: 1 } },
      ],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });
  }),

  // Timeseries endpoints
  http.get(`${API_BASE}/timeseries`, () => {
    return HttpResponse.json({
      total: 10,
      data: [],
    });
  }),

  // Models/forecasts endpoints
  http.get(`${API_BASE}/models`, () => {
    return HttpResponse.json({
      total: 5,
      data: [],
    });
  }),

  // Alert endpoints
  http.get(`${API_BASE}/alerts`, ({ request }) => {
    const url = new URL(request.url);
    const page = url.searchParams.get('page');
    // If requesting with limit=100 for stats, return more alerts
    if (url.searchParams.get('limit') === '100' || page === '1') {
      return HttpResponse.json({
        total: 15,
        data: [
          { id: 'alert-1', severity: 'critical', message: 'High temperature', type: 'threshold', isRead: false, createdAt: '2024-01-01T00:00:00Z' },
          { id: 'alert-2', severity: 'high', message: 'Anomaly detected', type: 'anomaly', isRead: false, createdAt: '2024-01-01T01:00:00Z' },
          { id: 'alert-3', severity: 'medium', message: 'Warning level', type: 'forecast', isRead: true, createdAt: '2024-01-01T02:00:00Z' },
          { id: 'alert-4', severity: 'low', message: 'Low priority', type: 'system', isRead: true, createdAt: '2024-01-01T03:00:00Z' },
        ],
      });
    }
    return HttpResponse.json({
      total: 0,
      data: [],
    });
  }),

  http.get(`${API_BASE}/alerts/stats`, () => {
    return HttpResponse.json({
      total: 15,
      bySeverity: { critical: 2, high: 3, medium: 5, low: 5 },
      unread: 8,
    });
  }),

  http.patch(`${API_BASE}/alerts/:id/read`, () => {
    return HttpResponse.json({ success: true });
  }),

  http.delete(`${API_BASE}/alerts/:id`, () => {
    return HttpResponse.json({ success: true });
  }),

  // CSRF token
  http.get('*/api/auth/csrf-token', () => {
    return HttpResponse.json({ csrfToken: 'test-csrf-token' });
  }),
];
