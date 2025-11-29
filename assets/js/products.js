// assets/js/products.js
// yeh file ab static array nahi, backend se live products load karegi

// API_BASE already assets/js/api.js me defined hai
// aur shop.html ya index.html me api.js isse pehle load ho raha hai

let PRODUCTS = []; // global list

async function fetchProducts() {
  try {
    const res = await fetch(`${API_BASE}/api/products`);
    if (!res.ok) {
      console.error("Failed to fetch products", res.status);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("fetchProducts error:", err);
    return [];
  }
}

// Example: product card render (simple)
function renderProductsGrid(products) {
  const container = document.getElementById("productsGrid");
  if (!container) return;

  if (!products.length) {
    container.innerHTML = "<p>No products available.</p>";
    return;
  }

  container.innerHTML = products
    .map((p) => {
      const price = p.price || 0;
      const mrp = p.mrp || price;
      const img =
        p.image || (p.images && p.images[0]) || "assets/img/placeholder.png";

      return `
        <div class="product-card">
          <a href="product.html?id=${p._id}">
            <img src="${img}" alt="${p.name || p.title || ""}" />
            <h3>${p.name || p.title || ""}</h3>
          </a>
          <div class="price-row">
            <span class="price">₹${price}</span>
            ${
              mrp && mrp > price
                ? `<span class="mrp">₹${mrp}</span>
                   <span class="off">${Math.round(
                     ((mrp - price) / mrp) * 100
                   )}% off</span>`
                : ""
            }
          </div>
          <button class="btn btn-sm btn-primary" onclick="addToCartFromListing('${p._id}')">
            Add to cart
          </button>
        </div>
      `;
    })
    .join("");
}

// Agar tumhare paas pehle se koi render function hai (shop.js me),
// to upar wala use karne ki zaroorat nahi; bas fetchProducts se data le ke
// usme pass kar dena.

async function initProductsPage() {
  PRODUCTS = await fetchProducts();

  // Agar tum search / filter use karte ho to yaha se bhi use kar sakte ho
  renderProductsGrid(PRODUCTS);
}

document.addEventListener("DOMContentLoaded", initProductsPage);
