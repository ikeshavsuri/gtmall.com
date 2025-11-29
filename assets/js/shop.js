// assets/js/shop.js

async function fetchProductsFromApi() {
  try {
    const res = await fetch(`${API_BASE}/api/products`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("fetchProductsFromApi error:", err);
    return [];
  }
}

function handleAddToCartFromShop(p) {
  if (typeof addToCart === "function") {
    addToCart({
      id: p._id,
      name: p.name || p.title || "",
      price: p.price || 0,
      img: p.image || (p.images && p.images[0]) || "",
    });
  } else {
    console.warn("addToCart not found");
  }
}

function renderProductsOnShop(products) {
  const container = document.getElementById("productsContainer");
  if (!container) return;

  if (!products.length) {
    container.innerHTML = "<p>No products available.</p>";
    return;
  }

  container.innerHTML = "";

  products.forEach((p) => {
    const card = document.createElement("div");
    card.className = "product-card";

    const imgUrl =
      p.image || (p.images && p.images[0]) || "assets/img/placeholder.png";
    const name = p.name || p.title || "";
    const price = p.price || 0;
    const mrp = p.mrp || price;
    const hasDiscount = mrp > price;

    card.innerHTML = `
      <a class="product-card-link" href="product.html?id=${p._id}">
        <div class="product-image-wrap">
          <img src="${imgUrl}" alt="${name}">
        </div>
        <div class="product-body">
          <h3 class="product-title">${name}</h3>
          <div class="product-price-row">
            <span class="product-price">₹${price}</span>
            ${
              hasDiscount
                ? `<span class="product-mrp">₹${mrp}</span>
                   <span class="product-off">${Math.round(
                     ((mrp - price) / mrp) * 100
                   )}% off</span>`
                : ""
            }
          </div>
        </div>
      </a>
      <button class="btn btn-sm btn-primary product-card-cart-btn">Add to cart</button>
    `;

    card
      .querySelector(".product-card-cart-btn")
      .addEventListener("click", (e) => {
        e.preventDefault();
        handleAddToCartFromShop(p);
      });

    container.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const products = await fetchProductsFromApi();
  renderProductsOnShop(products);
});
