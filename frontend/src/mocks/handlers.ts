/**
 * MSW Request Handlers
 *
 * Intercepts HTTP requests during tests and returns mock responses.
 * Response shapes match the real backend API format:
 *   { success: true, data: T } for single items
 *   { success: true, data: T[], pagination: {...} } for lists
 */

import { http, HttpResponse } from 'msw';

const API_BASE = 'http://localhost:8000/api';

// Test data
export const mockUser = {
  id: 'test-user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
};

export const mockToken = 'test-jwt-token-12345';

export const handlers = [
  // Auth endpoints — match backend's success() envelope
  http.post(`${API_BASE}/auth/login`, async () => {
    return HttpResponse.json({
      success: true,
      data: {
        user: mockUser,
        token: mockToken,
        refreshToken: 'test-refresh-token',
        sessionId: 'test-session-id',
      },
    });
  }),

  http.post(`${API_BASE}/auth/register`, async () => {
    return HttpResponse.json({
      success: true,
      data: {
        user: { ...mockUser, id: 'new-user-1' },
        token: 'new-jwt-token',
        refreshToken: 'new-refresh-token',
      },
    }, { status: 201 });
  }),

  http.get(`${API_BASE}/auth/verify`, () => {
    return HttpResponse.json({ success: true, data: { valid: true } });
  }),

  http.get(`${API_BASE}/auth/me`, () => {
    return HttpResponse.json({
      success: true,
      data: { user: mockUser },
    });
  }),

  http.post(`${API_BASE}/auth/logout`, () => {
    return HttpResponse.json({ success: true, data: null });
  }),

  // Dataset endpoints — match backend's paginated() envelope
  http.get(`${API_BASE}/datasets`, ({ request }) => {
    const _url = new URL(request.url);
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'ds-1', name: 'Temperature Data', slug: 'temperature-data', storageFormat: 'CSV', ownerId: 'test-user-1', createdAt: '2024-01-01T00:00:00Z', _count: { timeseries: 3 } },
        { id: 'ds-2', name: 'Pressure Data', slug: 'pressure-data', storageFormat: 'CSV', ownerId: 'test-user-1', createdAt: '2024-01-02T00:00:00Z', _count: { timeseries: 1 } },
      ],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });
  }),

  // Timeseries endpoints
  http.get(`${API_BASE}/timeseries`, () => {
    return HttpResponse.json({
      success: true,
      data: [],
      total: 10,
    });
  }),

  // Models/forecasts endpoints
  http.get(`${API_BASE}/models`, () => {
    return HttpResponse.json({
      success: true,
      data: [],
      total: 5,
    });
  }),

  // Alert endpoints
  http.get(`${API_BASE}/alerts`, ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.get('limit') === '100' || url.searchParams.get('page') === '1') {
      return HttpResponse.json({
        success: true,
        data: {
          alerts: [
            { id: 'alert-1', severity: 'critical', message: 'High temperature', type: 'threshold', isRead: false, createdAt: '2024-01-01T00:00:00Z' },
            { id: 'alert-2', severity: 'high', message: 'Anomaly detected', type: 'anomaly', isRead: false, createdAt: '2024-01-01T01:00:00Z' },
            { id: 'alert-3', severity: 'medium', message: 'Warning level', type: 'forecast', isRead: true, createdAt: '2024-01-01T02:00:00Z' },
            { id: 'alert-4', severity: 'low', message: 'Low priority', type: 'system', isRead: true, createdAt: '2024-01-01T03:00:00Z' },
          ],
          total: 4,
        },
      });
    }
    return HttpResponse.json({
      success: true,
      data: { alerts: [], total: 0 },
    });
  }),

  http.get(`${API_BASE}/alerts/stats`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        total: 15,
        bySeverity: { critical: 2, high: 3, medium: 5, low: 5 },
        unread: 8,
      },
    });
  }),

  http.patch(`${API_BASE}/alerts/:id/read`, () => {
    return HttpResponse.json({ success: true, data: null });
  }),

  http.delete(`${API_BASE}/alerts/:id`, () => {
    return HttpResponse.json({ success: true, data: null });
  }),

  // CSRF token
  http.get('*/api/auth/csrf-token', () => {
    return HttpResponse.json({ csrfToken: 'test-csrf-token' });
  }),
];
