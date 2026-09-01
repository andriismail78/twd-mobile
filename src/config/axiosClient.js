// src/config/axiosClient.js
import AsyncStorage from "@react-native-async-storage/async-storage"; // PENTING: Import ini harus ada
import axios from "axios";
import { API_BASE_URL } from "./api.config";

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

// Request Interceptor: Menyelipkan Token sebelum request dikirim
axiosClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem("twd_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Menangani error global
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Tangkap baik 401 (Unauthorized) maupun 403 (Forbidden)
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.warn("Unauthorized/Forbidden! Request diabaikan secara diam-diam.");
      return Promise.resolve({ data: { status: "success", data: [] } });
    }
    return Promise.reject(error);
  }
);

export default axiosClient;