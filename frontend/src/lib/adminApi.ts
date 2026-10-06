import axios from 'axios';
import { getApiBaseUrl } from './apiConfig';

export const adminApi = axios.create({
  baseURL: `${getApiBaseUrl()}/super-admin`,
  headers: {
    'Content-Type': 'application/json',
  },
});

adminApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('workgrind_super_admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/admin-portal/login')) {
        localStorage.removeItem('workgrind_super_admin_token');
        localStorage.removeItem('workgrind_super_admin_user');
        window.location.href = '/admin-portal/login';
      }
    }
    return Promise.reject(error);
  }
);
