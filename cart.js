// ---- CART UTILS ----
function getCart() {
  const stored = localStorage.getItem("cart");
  return stored ? JSON.parse(stored) : [];
}

function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
}

function addToCart(item) {
  const cart = getCart();
  const existing = cart.find(p => p.name === item.name);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...item, qty: 1 });
  }

  saveCart(cart);
  alert(`${item.name} added to cart!`);
}

// ---- ATTACH TO BUTTONS (on product pages) ----
document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".add-to-cart-btn");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.name;
      const price = Number(btn.dataset.price);
      const image = btn.dataset.image;

      addToCart({ name, price, image });
    });
  });
});
