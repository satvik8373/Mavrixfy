/// <reference types="vite/client" />

import axios from "axios";
import { API_BASE_URL } from "./apiConfig";
// Avoid importing Firebase eagerly to keep initial bundle small
// We'll lazy-import inside the interceptor

const axiosInstance = axios.create({
	baseURL: API_BASE_URL,
	timeout: 20000
});

// Function to set auth token for requests
export const setAuthToken = (token: string | null) => {
	if (token) {
		axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${token}`;
	} else {
		delete axiosInstance.defaults.headers.common["Authorization"];
	}
};

// Add request interceptor
axiosInstance.interceptors.request.use(
	async (config) => {
		// Keep multipart boundaries intact for file uploads.
		if (typeof FormData !== "undefined" && config.data instanceof FormData) {
			const headers = config.headers as any;
			if (headers && typeof headers.set === "function") {
				headers.set("Content-Type", undefined);
			} else if (headers) {
				delete headers["Content-Type"];
			}
		}

		// Get token from Firebase for each request (lazy import to avoid eager Firebase load)
		try {
			const { auth, waitForAuthReady } = await import('./firebase');
			await waitForAuthReady();
			if (auth.currentUser) {
				const token = await auth.currentUser.getIdToken();
				config.headers.Authorization = `Bearer ${token}`;
			}
		} catch (error) {
			// Ignore token retrieval errors silently
		}
		return config;
	},
	(error) => {
		return Promise.reject(error);
	}
);

// Add response interceptor
axiosInstance.interceptors.response.use(
	(response) => {
		return response;
	},
	async (error) => {
		// Handle 401 unauthorized - but ONLY redirect if truly not authenticated
		if (error.response?.status === 401) {
			// Check if Firebase still has a current user before redirecting
			try {
				const { auth } = await import('./firebase');
				if (auth.currentUser) {
					// User is still Firebase-authenticated; don't redirect.
					// The token may just need a refresh — clear the cached header.
					setAuthToken(null);
					return Promise.reject(error);
				}
			} catch {
				// firebase import failed — fall through to redirect check
			}

			// Also check localStorage cached auth before redirecting
			try {
				const raw = localStorage.getItem('auth-store');
				if (raw) {
					const parsed = JSON.parse(raw);
					const state = parsed?.state || parsed;
					if (state?.isAuthenticated && state?.userId) {
						// Cached auth exists — don't redirect, just clear the stale token header
						setAuthToken(null);
						return Promise.reject(error);
					}
				}
			} catch {
				// ignore localStorage read errors
			}

			// No Firebase user and no cached auth — genuinely unauthenticated
			setAuthToken(null);
			if (!window.location.pathname.startsWith('/login')) {
				window.location.href = '/login';
			}
		}
		return Promise.reject(error);
	}
);

export default axiosInstance;
