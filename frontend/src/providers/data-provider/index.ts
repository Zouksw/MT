"use client";

import { DataProvider } from "@refinedev/core";
import axios from "axios";
import { tokenManager } from "@/lib/tokenManager";
import { csrfProtection } from "@/lib/csrf";
import { errorHandler } from "@/lib/errorHandler";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Include cookies for HttpOnly auth cookies
});

/**
 * Request interceptor to add auth token and CSRF protection
 */
axiosInstance.interceptors.request.use(
  (config) => {
    // Add auth token from tokenManager
    const token = tokenManager.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add CSRF token for non-GET requests
    if (config.method && ['post', 'put', 'patch', 'delete'].includes(config.method.toLowerCase())) {
      const csrfHeaders = csrfProtection.getHeaders();
      Object.assign(config.headers, csrfHeaders);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor to handle errors and token refresh
 */
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Clear invalid token
      tokenManager.removeToken();

      // Only redirect for authenticated pages, not for initial data fetches
      // that happen on public pages like the landing page
      const isDataFetch = originalRequest.method === 'get';
      if (!isDataFetch && typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
        window.location.href = "/login?reason=unauthorized";
      }

      return Promise.reject(errorHandler.handleApiError(error));
    }

    // Handle other errors with safe error messages
    const safeError = errorHandler.handleApiError(error);
    return Promise.reject(safeError);
  }
);

/**
 * Custom data provider for IoTDB Enhanced backend
 * Adapts backend API response format to Refine's expected format
 */
export const dataProvider: DataProvider = {
  /**
   * Get API URL for a resource
   */
  getApiUrl: () => API_URL,

  /**
   * Get list of resources with pagination, filtering, and sorting
   */
  getList: async ({ resource, pagination, filters, sorters }) => {
    const { current = 1, pageSize = 10 } = (pagination as { current?: number; pageSize?: number }) || {};
    const sorter = (sorters && sorters[0]) || {};
    const sort = 'field' in sorter ? sorter.field : undefined;
    const order = 'order' in sorter ? sorter.order : undefined;

    const url = `/${resource}`;
    const params: Record<string, string | number | boolean> = {
      page: current,
      limit: pageSize,
    };

    if (sort) {
      params.sortBy = sort as string;
      params.order = order as string;
    }

    if (filters) {
      filters.forEach((filter) => {
        if ('field' in filter) {
          params[filter.field as string] = filter.value;
        }
      });
    }

    let response;
    try {
      response = await axiosInstance.get(url, { params });
    } catch (error: any) {
      // Return empty data for unauthenticated requests (e.g. landing page)
      if (error?.response?.status === 401) {
        return { data: [], total: 0 };
      }
      throw error;
    }
    const data = response.data;

    // Adapt backend response to Refine format
    let items: any[] = [];
    let total = 0;

    // Handle different response formats from backend
    if (resource === 'blog_posts') {
      items = data.blog_posts || data.data || data.items || [];
    } else if (resource === 'categories') {
      items = data.categories || data.data || data.items || [];
    } else if (resource === 'datasets') {
      items = data.datasets || data.data || data.items || [];
    } else {
      // Default format for our resources
      items = data.data || data.items || [];
    }

    // Extract total from response
    total = data.pagination?.total || data.total || items.length;

    return {
      data: items,
      total: total,
    };
  },

  /**
   * Get single resource by ID
   */
  getOne: async ({ resource, id }) => {
    const url = `/${resource}/${id}`;
    const response = await axiosInstance.get(url);
    const data = response.data;

    // Return data in Refine format
    const item = data.data || data;

    return {
      data: item,
    };
  },

  /**
   * Create new resource
   */
  create: async ({ resource, variables }) => {
    const response = await axiosInstance.post(`/${resource}`, variables);
    const data = response.data;

    const item = data.data || data;

    return {
      data: item,
    };
  },

  /**
   * Update resource by ID
   */
  update: async ({ resource, id, variables }) => {
    const response = await axiosInstance.patch(`/${resource}/${id}`, variables);
    const data = response.data;

    const item = data.data || data;

    return {
      data: item,
    };
  },

  /**
   * Delete resource by ID
   */
  deleteOne: async ({ resource, id }) => {
    await axiosInstance.delete(`/${resource}/${id}`);

    return {
      data: { id } as any,
    };
  },

  /**
   * Custom API method for specific endpoints
   */
  custom: async ({ url, method, payload, query, headers }) => {
    let response;

    const config: Record<string, unknown> = {
      params: query,
    };

    if (headers) {
      config.headers = headers;
    }

    switch (method) {
      case 'get':
        response = await axiosInstance.get(url, config);
        break;
      case 'post':
        response = await axiosInstance.post(url, payload, config);
        break;
      case 'patch':
        response = await axiosInstance.patch(url, payload, config);
        break;
      case 'put':
        response = await axiosInstance.put(url, payload, config);
        break;
      case 'delete':
        response = await axiosInstance.delete(url, config);
        break;
      default:
        response = await axiosInstance.get(url, config);
    }

    return {
      data: response.data,
    };
  },
};

export default dataProvider;
