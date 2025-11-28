// assets/js/api.js
const API_BASE = "https://gtmall-com.onrender.com";  // yahi tumhara Render backend

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "x-user-id":    localStorage.getItem("userUid")   || "",
    "x-user-email": localStorage.getItem("userEmail") || "",
    "x-user-name":  localStorage.getItem("userName")  || ""
  };
}
