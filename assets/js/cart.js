// assets/js/cart.js
// Centralised cart utilities (localStorage based)
// API_BASE + authHeaders are defined in assets/js/api.js

function isLoggedIn() {
  try {
    return !!localStorage.getItem("userUid");
  } catch {
    return false;
  }
}

function getCart() {
  try {
    const raw = localStorage.getItem("cartItems") || "[]";
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem("cartItems", JSON.stringify(cart || []));
  } catch (e) {
    console.error("Failed to save cart:", e);
  }
}

/**
 * Normalise any product object coming from backend / UI
 * into the shape stored in cart: { id, name, price, img, quantity }
 */
function normalizeProduct(raw) {
  if (!raw || typeof raw !== "object") return null;

  const id =
    raw.id ||
    raw._id ||
    raw.productId ||
    (typeof raw === "string" ? raw : "");

  const name = raw.name || raw.title || raw.productName || "";
  const price = Number(raw.price || 0);

  const img =
    raw.img ||
    raw.image ||
    (Array.isArray(raw.images) && raw.images[0]) ||
    "assets/img/placeholder.png";

  if (!id) return null;

  return {
    id: String(id),
    name,
    price,
    img,
  };
}

/**
 * Low-level helper: add/update an item in cart with qty
 */
function addProductToCart(rawProduct, qty) {
  const product = normalizeProduct(rawProduct);
  if (!product) return;

  const quantity = Number(qty || rawProduct.quantity || 1) || 1;
  let cart = getCart();
  const existing = cart.find((i) => i.id === product.id);
  if (existing) {
    existing.quantity = (existing.quantity || 1) + quantity;
  } else {
    cart.push({ ...product, quantity });
  }
  saveCart(cart);
  updateCartBadge();

  // optional toast
  try {
    alert("Added to cart");
  } catch {
    // ignore if alerts blocked
  }
}

/**
 * Called directly from UI with a product object
 * (used on product.html, home page featured products, shop page helper, etc.)
 */
function addToCart(product) {
  addProductToCart(product, product && product.quantity ? product.quantity : 1);
}

/**
 * Used from listing templates where we have productId only.
 * e.g. products.js uses onclick="addToCartFromListing('<id>')"
 */
function addToCartFromListing(productId) {
  if (!productId) return;

  // If someone accidentally passed full object instead of id, handle that too
  if (typeof productId === "object") {
    addProductToCart(productId, 1);
    return;
  }

  let sourceList = [];
  try {
    if (Array.isArray(window.PRODUCTS)) {
      sourceList = window.PRODUCTS;
    }
  } catch {
    // window may not exist in some environments
  }

  const prod =
    sourceList.find(
      (p) =>
        p._id === productId ||
        p.id === productId ||
        String(p._id) === String(productId) ||
        String(p.id) === String(productId)
    ) || null;

  if (prod) {
    addProductToCart(prod, 1);
  } else {
    console.warn("addToCartFromListing: product not found for id:", productId);
  }
}

// Badge in navbar
function updateCartBadge() {
  const badge = document.getElementById("cart-count-badge");
  if (!badge) return;
  const cart = getCart();
  const count = cart.reduce((sum, item) => {
    const q = Number(item.quantity || 1) || 1;
    return sum + q;
  }, 0);

  if (count > 0) {
    badge.textContent = String(count);
    badge.style.display = "inline-block";
  } else {
    badge.style.display = "none";
  }
}

// Cart page rendering
function renderCartPage() {
  const container = document.getElementById("cartItemsContainer");
  const totalEl = document.getElementById("cartTotal");
  if (!container) return;

  const cart = getCart();
  if (!cart.length) {
    container.innerHTML = "<p>Your cart is empty.</p>";
    if (totalEl) totalEl.textContent = "0";
    return;
  }

  container.innerHTML = "";
  let total = 0;

  cart.forEach((item, index) => {
    const price = Number(item.price || 0);
    const qty = Number(item.quantity || 1) || 1;
    const line = price * qty;
    total += line;

    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <img src="${item.img || "assets/img/placeholder.png"}" alt="${item.name || ""}">
      <div style="flex:1;">
        <h6>${item.name || ""}</h6>
        <p>₹${price}</p>
        <div class="quantity-box">
          <button class="quantity-btn" onclick="changeQty(${index}, -1)">-</button>
          <span>${qty}</span>
          <button class="quantity-btn" onclick="changeQty(${index}, 1)">+</button>
        </div>
      </div>
      <div>
        <p>₹${line}</p>
        <button class="btn btn-sm btn-outline-danger" onclick="removeItem(${index})">Remove</button>
      </div>
    `;
    container.appendChild(div);
  });

  if (totalEl) {
    totalEl.textContent = String(total);
  }
}

function changeQty(index, delta) {
  const cart = getCart();
  if (!cart[index]) return;
  const current = Number(cart[index].quantity || 1) || 1;
  const next = current + Number(delta || 0);
  if (next <= 0) return;
  cart[index].quantity = next;
  saveCart(cart);
  renderCartPage();
  updateCartBadge();
}

function removeItem(index) {
  const cart = getCart();
  if (index < 0 || index >= cart.length) return;
  cart.splice(index, 1);
  saveCart(cart);
  renderCartPage();
  updateCartBadge();
}

document.addEventListener("DOMContentLoaded", () => {
  renderCartPage();
  updateCartBadge();
});