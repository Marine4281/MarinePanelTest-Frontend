// src/api/axios.js

import axios from "axios";

const BASE_DOMAIN = "https://marine-panel-test-frontend.vercel.app";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
  timeout: 30000, // 30s — long enough for image uploads / Render cold starts, still bounded
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    Expires: "0",
  },
});

/* =========================================================
REQUEST INTERCEPTOR
========================================================= */
api.interceptors.request.use(
  (config) => {
    /* =====================================================
    1. LOAD USER SAFELY
    ===================================================== */
    let user = {};
    try {
      user = JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      user = {};
    }

    /* =====================================================
    2. TOKEN
    ===================================================== */
    const token = localStorage.getItem("token") || user?.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    /* =====================================================
    2b. FILE UPLOADS (FormData)
       The instance default Content-Type is "application/json".
       If that header is still present when the payload is
       FormData, axios will serialize the FormData into a JSON
       string instead of sending it as multipart — the file
       never reaches the server and multer sees req.file as
       undefined. Strip it here so the browser sets the correct
       "multipart/form-data; boundary=..." header itself.
    ===================================================== */
    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      delete config.headers["Content-Type"];
      if (typeof config.headers.delete === "function") {
        config.headers.delete("Content-Type");
      }
    }

    /* =====================================================
    3. DOMAIN DETECTION
    ===================================================== */
    const hostname = window.location.hostname;
    const fullHost = window.location.host;

    const isMainPlatform =
      hostname === BASE_DOMAIN ||
      hostname === `www.${BASE_DOMAIN}` ||
      hostname === "localhost" ||
      hostname === "127.0.0.1";

    /* =====================================================
    4. MAIN PLATFORM — no extra headers
    ===================================================== */
    if (isMainPlatform) return config;

    /* =====================================================
    5. NON-MAIN DOMAIN
       Send BOTH headers so the backend can detect which type
       this domain is without us needing to know up front.
       The backend middleware (reseller first, then childPanel)
       picks up whichever one matches.
       This is intentional — do NOT remove one of them.
       detectDomainType() calls /child-panel/branding and
       /end-user/branding WITHOUT a user token, so it needs
       the domain headers to let the backend identify the panel.
    ===================================================== */
    config.headers["x-childpanel-domain"] = fullHost;
    config.headers["x-reseller-domain"]   = fullHost;

    return config;
  },
  (error) => Promise.reject(error)
);

/* =========================================================
RESPONSE INTERCEPTOR
========================================================= */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log for debugging — never swallow silently
    if (error.code === "ECONNABORTED" || !error.response) {
      // Network / timeout error — the detectDomainType retry loop handles this
      console.warn("Network error or timeout:", error.message);
    } else {
      console.error("API Error:", error?.response?.data || error.message);
    }
    return Promise.reject(error);
  }
);

export default api;
