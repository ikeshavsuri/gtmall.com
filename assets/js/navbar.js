document.addEventListener("DOMContentLoaded", () => {
  const userName = localStorage.getItem("userName");
  const userEmail = localStorage.getItem("userEmail");

  const myAccountDropdown = document.getElementById("myAccountDropdown");
  const loginNavItem = document.getElementById("loginNavItem");
  const navUserGreeting = document.getElementById("navUserGreeting");
  const navUserEmail = document.getElementById("navUserEmail");
  const navLogoutBtn = document.getElementById("navLogoutBtn");

  if (userName) {
    loginNavItem?.classList.add("d-none");
    myAccountDropdown?.classList.remove("d-none");
    if (navUserGreeting) navUserGreeting.textContent = "Hi, " + userName.split(" ")[0];
    if (navUserEmail && userEmail) navUserEmail.textContent = userEmail;
  } else {
    loginNavItem?.classList.remove("d-none");
    myAccountDropdown?.classList.add("d-none");
  }

  navLogoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userUid");
    window.location.href = "index.html";
  });

  const searchForm = document.getElementById("nav-search-form");
  const searchInput = document.getElementById("nav-search-input");
  searchForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    if (!q) return;
    window.location.href = "shop.html"; // you can add ?search=
  });

  updateCartBadge();
});
