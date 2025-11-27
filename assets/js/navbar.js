// assets/js/navbar.js

function initNavbar() {
  // Login info (login.js se set hoti hai)
  const userName = localStorage.getItem("userName");
  const userEmail = localStorage.getItem("userEmail");

  const myAccountDropdown = document.getElementById("myAccountDropdown");
  const loginNavItem      = document.getElementById("loginNavItem");
  const navUserGreeting   = document.getElementById("navUserGreeting");
  const navUserEmail      = document.getElementById("navUserEmail");
  const navLogoutBtn      = document.getElementById("navLogoutBtn");

  // ---------- LOGIN / LOGOUT UI ----------
  if (userName) {
    // Logged in state
    if (loginNavItem)      loginNavItem.classList.add("d-none");
    if (myAccountDropdown) myAccountDropdown.classList.remove("d-none");

    if (navUserGreeting) {
      navUserGreeting.textContent = "Hi, " + userName.split(" ")[0];
    }
    if (navUserEmail && userEmail) {
      navUserEmail.textContent = userEmail;
    }
  } else {
    // Logged out state
    if (loginNavItem)      loginNavItem.classList.remove("d-none");
    if (myAccountDropdown) myAccountDropdown.classList.add("d-none");
  }

  // ---------- LOGOUT BUTTON ----------
  if (navLogoutBtn) {
    navLogoutBtn.addEventListener("click", (e) => {
      e.preventDefault();

      // Jo bhi auth info hai, clear karo
      localStorage.removeItem("userUid");
      localStorage.removeItem("userName");
      localStorage.removeItem("userEmail");

      // Redirect back to home (ya chaaho to login.html)
      window.location.href = "index.html";
    });
  }

  // ---------- SEARCH BAR ----------
  const searchForm  = document.getElementById("nav-search-form");
  const searchInput = document.getElementById("nav-search-input");

  if (searchForm && searchInput) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = searchInput.value.trim();
      if (!q) {
        // agar empty search hai to direct shop page
        window.location.href = "shop.html";
        return;
      }
      window.location.href = "shop.html?search=" + encodeURIComponent(q);
    });
  }

  // ---------- CART BADGE ----------
  // Agar cart.js loaded hai aur updateCartBadge function defined hai
  if (typeof updateCartBadge === "function") {
    updateCartBadge();
  }
}

// Agar DOM abhi load ho raha hai to event pe chalao,
// warna turant chalao (dynamic navbar ke case me)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNavbar);
} else {
  initNavbar();
}
