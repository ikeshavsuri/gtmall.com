// assets/js/shop.js
// yeh file seller panel se aaye huye products ko backend se fetch karke
// shop page par dikhayegi

async function fetchProductsFromApi() {
  try {
    const res = await fetch(`${API_BASE}/api/products`);
    if (!res.ok) {
      console.error("Failed to fetch products", res.status);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("fetchProductsFromApi error:", err);
    return [];
  }
}

function handleAddToCartFromShop(p) {
  // agar tumhare cart.js me addToCart naam ka function hai:
  if (typeof addToCart === "function") {
    addToCart({
      id: p._id,
      name: p.name || p.title || "",
      price: p.price || 0,
      img: p.image || (p.images && p.images[0]) || "",
    });
  } else {
    console.warn("addToCart function not found");
  }
}

function renderProductsOnShop(products) {
  const container = document.getElementById("productsContainer");
  if (!container) return;

  if (!products.length) {
    container.innerHTML = "<p>No products available.</p>";
    return;
  }

  container.innerHTML = ""; // clear old html

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
      <div class="product-image-wrap">
        <img src="${imgUrl}" alt="${name}">
      </div>
      <h3 class="product-title">${name}</h3>
      <div class="product-price-row">
        <span class="product-price">₹${price}</span>
        ${
          hasDiscount
            ? `<span class="product-mrp">₹${mrp}</span>
               <span class="product-off">${
                 Math.round(((mrp - price) / mrp) * 100) || 0
               }% off</span>`
            : ""
        }
      </div>
      <button class="btn btn-sm btn-primary">Add to cart</button>
    `;

    const btn = card.querySelector("button");
    btn.addEventListener("click", () => handleAddToCartFromShop(p));

    container.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const products = await fetchProductsFromApi();
  renderProductsOnShop(products);
});
