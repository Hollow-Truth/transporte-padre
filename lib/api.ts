import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './constants';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // NestJS returns message as array for validation errors - convert to string
    // This prevents Android crash: "ReadableNativeArray cannot be cast to String"
    if (error?.response?.data?.message) {
      if (Array.isArray(error.response.data.message)) {
        error.response.data.message = error.response.data.message.join(', ');
      }
    }
    if (error?.message && Array.isArray(error.message)) {
      error.message = error.message.join(', ');
    }

    const isAuthRoute = error.config?.url?.startsWith('/auth/');
    if (error.response?.status === 401 && !isAuthRoute) {
      await AsyncStorage.removeItem('access_token');
      await AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export default api;
