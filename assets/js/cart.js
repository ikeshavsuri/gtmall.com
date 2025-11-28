// CART UTILITIES (local, plus optional sync later)
function isLoggedIn() {
  return !!localStorage.getItem("userUid");
}

// existing getCart / saveCart rehne do

async function syncCartToServer() {
  if (!isLoggedIn()) return;
  const cart = getCart();
  try {
    await fetch(API_BASE + "/api/cart/mine", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ items: cart })
    });
  } catch (e) {
    console.error("Failed to sync cart:", e);
  }
}

// page load pe server se cart laane ke liye:
document.addEventListener("DOMContentLoaded", async () => {
  if (isLoggedIn()) {
    try {
      const res = await fetch(API_BASE + "/api/cart/mine", {
        headers: authHeaders()
      });
      if (res.ok) {
        const items = await res.json();
        saveCart(items);
      }
    } catch (e) {
      console.error("Failed to load cart from server:", e);
    }
  }

  renderCartPage();
  updateCartBadge();
});

function getCart() {
  try {
    return JSON.parse(localStorage.getItem("cartItems") || "[]");
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem("cartItems", JSON.stringify(cart));
}

function addToCart(product) {
  let cart = getCart();
  const existing = cart.find(i => i.id === product.id);
  if (existing) existing.quantity += 1;
  else cart.push({ id: product.id, name: product.name, price: product.price, img: product.img, quantity: 1 });
  saveCart(cart);
  alert("Added to cart");
  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.getElementById("cart-count-badge");
  const cart = getCart();
  const count = cart.reduce((s,i)=>s + (i.quantity||1), 0);
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = "inline-block";
  } else {
    badge.style.display = "none";
  }
}

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
    const line = (item.price || 0) * (item.quantity || 1);
    total += line;
    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <img src="${item.img}" alt="${item.name}">
      <div style="flex:1;">
        <h6>${item.name}</h6>
        <p>₹${item.price}</p>
        <div class="quantity-box">
          <button class="quantity-btn" onclick="changeQty(${index}, -1)">-</button>
          <span>${item.quantity}</span>
          <button class="quantity-btn" onclick="changeQty(${index}, 1)">+</button>
        </div>
        <span class="remove-btn" onclick="removeItem(${index})">Remove</span>
      </div>`;
    container.appendChild(div);
  });
  if (totalEl) totalEl.textContent = total.toString();
}

function changeQty(index, val) {
  const cart = getCart();
  if (!cart[index]) return;
  const newQty = (cart[index].quantity || 1) + val;
  if (newQty <= 0) return;
  cart[index].quantity = newQty;
  saveCart(cart);
  renderCartPage();
  updateCartBadge();
}

function removeItem(index) {
  const cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
  renderCartPage();
  updateCartBadge();
}

document.addEventListener("DOMContentLoaded", () => {
  renderCartPage();
  updateCartBadge();
});
