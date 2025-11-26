// assets/js/products.js

// ---- PRODUCT DATA (yahan tum apne products badha sakte ho) ----
const PRODUCTS = [
  {
    id: 1,
    name: "Solar Wall Lamp",
    brand: "GT Home",
    category: "Lights",
    price: 142,
    img: "assets/img/product/solarlamp.png",
    tags: ["solar", "lamp", "garden", "outdoor"],
    features: ["waterproof", "wall mounted"]
  },
  {
    id: 2,
    name: "2 in 1 Wireless Vacuum Cleaner",
    brand: "GT Clean",
    category: "Home Appliance",
    price: 198,
    img: "assets/img/product/vacuum.png",
    tags: ["vacuum", "cleaner", "wireless", "rechargeable"],
    features: ["2 in 1", "portable"]
  },
  {
    id: 3,
    name: "3D VR Box Virtual Reality Headset",
    brand: "VR Pro",
    category: "Gadgets",
    price: 298,
    img: "assets/img/product/vr.png",
    tags: ["vr", "virtual reality", "headset", "gaming"],
    features: ["3D", "adjustable lenses"]
  },
  {
    id: 4,
    name: "Fire-Boltt Talk 2 Pro Smartwatch",
    brand: "Fire-Boltt",
    category: "Smartwatch",
    price: 1998,
    img: "assets/img/product/talk 2 pro.png",
    tags: ["smartwatch", "call", "talk", "bluetooth"],
    features: ["BT calling", "sports mode", "health tracking"]
  }
];

// ---- HELPER: TEXT NORMALIZE ----
function normalize(str) {
  return (str || "").toString().toLowerCase();
}

// ---- HELPER: product ek query se match karta hai ya nahi ----
function productMatches(product, query) {
  const q = normalize(query);

  if (!q) return true; // empty query => sab match

  // multiple words support: "black watch call"
  const tokens = q.split(/\s+/).filter(Boolean);

  // product ke sab text fields ek saath jod do
  const searchableText = normalize(
    [
      product.name,
      product.brand,
      product.category,
      (product.tags || []).join(" "),
      (product.features || []).join(" "),
      product.description || ""
    ].join(" ")
  );

  // har token text ke andar hona chahiye
  return tokens.every((t) => searchableText.includes(t));
}

// ---- RENDER FUNCTION ----
function renderProducts(list, options = {}) {
  const container = document.getElementById("shopProducts");
  if (!container) return;

  const { message, messageType } = options;

  container.innerHTML = "";

  // upar info / warning message
  if (message) {
    container.innerHTML += `
      <div class="col-12">
        <div class="alert alert-${messageType || "info"} mb-3">
          ${message}
        </div>
      </div>
    `;
  }

  // agar list khali hai to bhi ek simple message
  if (!list.length) {
    container.innerHTML += `
      <div class="col-12">
        <p class="text-center text-muted my-4">No products to display.</p>
      </div>
    `;
    return;
  }

  // product cards
  list.forEach((p) => {
    container.innerHTML += `
      <div class="col-6 col-md-3 mb-3">
        <div class="card p-2 h-100">
          <img src="${p.img}" class="card-img-top" alt="${p.name}">
          <div class="card-body d-flex flex-column">
            <h5 class="card-title" style="font-size:0.95rem;">${p.name}</h5>
            <p class="text-muted mb-1" style="font-size:0.8rem;">${p.brand || ""}</p>
            <p class="card-text mb-2"><strong>₹${p.price}</strong></p>
            <div class="mt-auto d-flex gap-2">
              <a href="product.html?id=${p.id}" class="btn btn-sm btn-outline-success w-50">
                View
              </a>
              <button class="btn btn-sm btn-success w-50" onclick='addProductToCart(${p.id})'>
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  });
}

// ---- ADD TO CART (ye helper PRODUCTS se product find karega) ----
function addProductToCart(id) {
  try {
    const product = PRODUCTS.find((p) => p.id === id);
    if (!product) return;

    // Agar tumhare cart.js me addToCart naam ka function hai jo
    // pura product leta hai, to ye sahi rahega:
    if (typeof addToCart === "function") {
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        img: product.img
      });
    } else {
      // warna hum localStorage se basic cart handle kar sakte hain:
      let cart = JSON.parse(localStorage.getItem("cartItems") || "[]");
      const existing = cart.find((item) => item.id === product.id);
      if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
      } else {
        cart.push({
          id: product.id,
          name: product.name,
          price: product.price,
          img: product.img,
          quantity: 1
        });
      }
      localStorage.setItem("cartItems", JSON.stringify(cart));
      alert("Added to cart");
    }
  } catch (e) {
    console.error("Cart error:", e);
  }
}

// ---- PAGE LOAD: ADVANCED SEARCH HANDLE ----
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("shopProducts");
  if (!container) return; // shop page nahi hai

  const params = new URLSearchParams(window.location.search);
  const rawQuery = (params.get("search") || "").trim();
  const query = rawQuery.toLowerCase();

  // koi search nahi => normal shop view
  if (!query) {
    renderProducts(PRODUCTS);
    return;
  }

  // query ke hisaab se filter
  const matched = PRODUCTS.filter((p) => productMatches(p, query));

  if (!matched.length) {
    // ❌ koi match nahi mila
    renderProducts(PRODUCTS, {
      message:
        'No product available to your related keywords. Showing all products instead.',
      messageType: "warning"
    });
  } else {
    // ✅ kuch results mile
    renderProducts(matched, {
      message: `Showing ${matched.length} result(s) for "<strong>${rawQuery}</strong>".`
    });
  }
});
