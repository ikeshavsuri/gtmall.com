document.addEventListener("DOMContentLoaded", () => {
  const userName = localStorage.getItem("userName");
  const userEmail = localStorage.getItem("userEmail");

  const myAccountDropdown = document.getElementById("myAccountDropdown");
  const loginNavItem = document.getElementById("loginNavItem");
  const navUserGreeting = document.getElementById("navUserGreeting");
  const navUserEmail = document.getElementById("navUserEmail");
  const navLogoutBtn = document.getElementById("navLogoutBtn");

  // Show login or account dropdown
  if (userName) {
    loginNavItem?.classList.add("d-none");
    myAccountDropdown?.classList.remove("d-none");

    if (navUserGreeting) navUserGreeting.textContent = "Hi, " + userName.split(" ")[0];
    if (navUserEmail && userEmail) navUserEmail.textContent = userEmail;

  } else {
    loginNavItem?.classList.remove("d-none");
    myAccountDropdown?.classList.add("d-none");
  }

  // Logout
  navLogoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userMobile");
    sessionStorage.removeItem("welcomeShown");
    window.location.href = "index.html";
  });

  // Search redirect to shop page
  const searchForm = document.getElementById("nav-search-form");
  const searchInput = document.getElementById("nav-search-input");

  searchForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    if (!q) return;
    window.location.href = "shop.html?search=" + encodeURIComponent(q);
  });

  // Update cart badge
  const cartBadge = document.getElementById("cart-count-badge");
  try {
    const cartItems = JSON.parse(localStorage.getItem("cartItems") || "[]");
    const count = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
    if (count > 0) {
      cartBadge.textContent = count;
      cartBadge.style.display = "inline-block";
    }
  } catch (err) {
    console.error("Cart badge error:", err);
  }
});
