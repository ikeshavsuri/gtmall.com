// assets/js/product-detail.js

let CURRENT_PRODUCT = null;
let currentQty = 1;

function getProductIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function renderProduct(p) {
  CURRENT_PRODUCT = p;

  const imgUrl =
    p.image || (p.images && p.images[0]) || "assets/img/placeholder.png";
  document.getElementById("prodImage").src = imgUrl;
  document.getElementById("prodImage").alt = p.name || p.title || "";

  const name = p.name || p.title || "";
  document.getElementById("prodName").textContent = name;
  document.getElementById("prodCategory").textContent =
    p.category ? `Category: ${p.category}` : "";

  const price = p.price || 0;
  const mrp = p.mrp || price;
  document.getElementById("prodPrice").textContent = `₹${price}`;
  document.getElementById("prodMrp").textContent =
    mrp > price ? `₹${mrp}` : "";
  document.getElementById("prodOff").textContent =
    mrp > price
      ? `${Math.round(((mrp - price) / mrp) * 100)}% off`
      : "";

  document.getElementById("prodShortDesc").textContent =
    p.shortDescription || "";

  document.getElementById("prodDescription").textContent =
    p.description || p.longDescription || p.shortDescription || "";
}

function renderSimilar(products) {
  const container = document.getElementById("similarProducts");
  if (!container) return;
  if (!products.length) {
    container.innerHTML = "<p>No similar products.</p>";
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
    `;

    container.appendChild(card);
  });
}

function updateQty(delta) {
  currentQty = Math.max(1, currentQty + delta);
  document.getElementById("qtyValue").textContent = currentQty;
}

function setupQtyControls() {
  document.getElementById("qtyMinus").addEventListener("click", () =>
    updateQty(-1)
  );
  document.getElementById("qtyPlus").addEventListener("click", () =>
    updateQty(1)
  );
}

function setupCartButtons() {
  document
    .getElementById("addToCartBtn")
    .addEventListener("click", () => {
      if (!CURRENT_PRODUCT || typeof addToCart !== "function") return;
      addToCart({
        id: CURRENT_PRODUCT._id,
        name: CURRENT_PRODUCT.name || CURRENT_PRODUCT.title || "",
        price: CURRENT_PRODUCT.price || 0,
        img:
          CURRENT_PRODUCT.image ||
          (CURRENT_PRODUCT.images && CURRENT_PRODUCT.images[0]) ||
          "",
        quantity: currentQty,
      });
    });

  document.getElementById("buyNowBtn").addEventListener("click", () => {
    if (!CURRENT_PRODUCT || typeof addToCart !== "function") return;
    addToCart({
      id: CURRENT_PRODUCT._id,
      name: CURRENT_PRODUCT.name || CURRENT_PRODUCT.title || "",
      price: CURRENT_PRODUCT.price || 0,
      img:
        CURRENT_PRODUCT.image ||
        (CURRENT_PRODUCT.images && CURRENT_PRODUCT.images[0]) ||
        "",
      quantity: currentQty,
    });
    window.location.href = "cart.html";
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const id = getProductIdFromUrl();
  if (!id) return;

  setupQtyControls();
  setupCartButtons();

  try {
    const product = await fetchJson(`${API_BASE}/api/products/${id}`);
    renderProduct(product);

    const similar = await fetchJson(
      `${API_BASE}/api/products/${id}/similar`
    );
    renderSimilar(similar);
  } catch (err) {
    console.error("Product detail load error:", err);
  }
});
