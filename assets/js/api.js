// assets/js/api.js
// Central API & auth helper for GT Mall frontend

// 🔴 IMPORTANT: Render backend URL
const API_BASE = "https://gtmall-com.onrender.com";

/**
 * Auth headers helper
 * Backend expects:
 *  - x-user-id
 *  - x-user-email
 *  - x-user-name
 */
function authHeaders() {
  return {
    "Content-Type": "application/json",
    "x-user-id": localStorage.getItem("userId") || "",
    "x-user-email": localStorage.getItem("userEmail") || "",
    "x-user-name": localStorage.getItem("userName") || ""
  };
}

/**
 * Optional helper for GET requests
 */
async function apiGet(path) {
  const res = await fetch(API_BASE + path, {
    method: "GET",
    headers: authHeaders()
  });
  if (!res.ok) throw new Error("API GET failed: " + path);
  return res.json();
}

/**
 * Optional helper for POST requests
 */
async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("API POST failed: " + path);
  return res.json();
}

/**
 * Optional helper for PUT requests
 */
async function apiPut(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("API PUT failed: " + path);
  return res.json();
}

/**
 * Optional helper for DELETE requests
 */
async function apiDelete(path) {
  const res = await fetch(API_BASE + path, {
    method: "DELETE",
    headers: authHeaders()
  });
  if (!res.ok) throw new Error("API DELETE failed: " + path);
  return res.json();
}
