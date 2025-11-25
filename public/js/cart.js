// GET CART
function getCart() {
  try {
    return JSON.parse(localStorage.getItem("cartItems") || "[]");
  } catch {
    return [];
  }
}

// SAVE CART
function saveCart(cart) {
  localStorage.setItem("cartItems", JSON.stringify(cart));
}

// ADD TO CART
function addToCart(product) {
  let cart = getCart();

  const existing = cart.find((x) => x.id === product.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      img: product.img,
      quantity: 1
    });
  }

  saveCart(cart);
  alert("Added to Cart!");
  updateCartBadge();
}

// UPDATE CART BADGE IN NAVBAR
function updateCartBadge() {
  const badge = document.getElementById("cart-count-badge");
  const cart = getCart();
  const count = cart.reduce((sum, i) => sum + i.quantity, 0);

  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = "inline-block";
    } else {
      badge.style.display = "none";
    }
  }
}

// CART PAGE RENDER
function renderCartPage() {
  const container = document.getElementById("cartItemsContainer");
  const totalEl = document.getElementById("cartTotal");
  const checkoutBtn = document.getElementById("checkoutBtn");

  if (!container) return;

  let cart = getCart();

  if (cart.length === 0) {
    container.innerHTML = "<p>Your cart is empty.</p>";
    if (totalEl) totalEl.textContent = "₹0";
    checkoutBtn?.remove();
    return;
  }

  container.innerHTML = "";
  let total = 0;

  cart.forEach((item, index) => {
    const sum = item.quantity * item.price;
    total += sum;

    container.innerHTML += `
      <div class="cart-item">
        <img src="${item.img}">
        <div style="flex:1;">
          <h6>${item.name}</h6>
          <p>₹${item.price}</p>

          <div class="quantity-box">
            <button class="quantity-btn" onclick="changeQty(${index}, -1)">-</button>
            <span>${item.quantity}</span>
            <button class="quantity-btn" onclick="changeQty(${index}, 1)">+</button>
          </div>

          <span class="remove-btn" onclick="removeItem(${index})">Remove</span>
        </div>
      </div>
    `;
  });

  if (totalEl) totalEl.textContent = "₹" + total;
}

// CHANGE QUANTITY
function changeQty(index, val) {
  let cart = getCart();
  if (cart[index].quantity + val <= 0) return;

  cart[index].quantity += val;
  saveCart(cart);
  renderCartPage();
  updateCartBadge();
}

// REMOVE ITEM
function removeItem(index) {
  let cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
  renderCartPage();
  updateCartBadge();
}

document.addEventListener("DOMContentLoaded", () => {
  renderCartPage();
  updateCartBadge();
});
