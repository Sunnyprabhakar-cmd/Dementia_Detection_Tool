const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

if (!configuredApiUrl) {
  throw new Error("VITE_API_URL is required to configure the frontend backend URL.");
}

export const API_BASE_URL = configuredApiUrl;
