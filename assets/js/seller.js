// assets/js/seller.js
// Assume: API_BASE & authHeaders() are defined in assets/js/api.js

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

function productPayloadFromForm() {
  const name = document.getElementById("name").value.trim();
  const description = document
    .getElementById("description")
    .value.trim(); // ⬅ ye line important

  const price = Number(document.getElementById("price").value || 0);
  const mrp = Number(document.getElementById("mrp").value || price);
  const category = document.getElementById("category").value.trim();
  const image = document.getElementById("image").value.trim();
  const stock = Number(document.getElementById("stock").value || 0);

  return {
    name,
    title: name,
    description,              // ⬅ backend me save hoga
    shortDescription: description, // (optional) agar detail page me chahiye
    price,
    mrp,
    category,
    image,
    images: image ? [image] : [],
    stock,
    isActive: true,
  };
}


function fillFormWithProduct(p) {
  document.getElementById("productId").value = p._id || "";
  document.getElementById("name").value = p.name || p.title || "";
  document.getElementById("description").value = p.description || "";
  document.getElementById("price").value = p.price || "";
  document.getElementById("mrp").value = p.mrp || "";
  document.getElementById("category").value = p.category || "";
  document.getElementById("image").value = p.image || (p.images && p.images[0]) || "";
  document.getElementById("stock").value = p.stock || 0;
  document.getElementById("formTitle").textContent = "Edit Product";
}

function resetForm() {
  document.getElementById("productId").value = "";
  document.getElementById("productForm").reset();
  document.getElementById("formTitle").textContent = "Add New Product";
}

function renderProductsTable(products) {
  const tbody = document.getElementById("productsTableBody");
  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="6">No products yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  products.forEach((p) => {
    const tr = document.createElement("tr");

    const imgUrl = p.image || (p.images && p.images[0]) || "";

    tr.innerHTML = `
      <td>${p.name || p.title || ""}</td>
      <td>₹${p.price || 0}</td>
      <td>${p.category || ""}</td>
      <td>
        ${
          imgUrl
            ? `<img src="${imgUrl}" style="width:50px;height:50px;object-fit:cover" />`
            : "-"
        }
      </td>
      <td>${p.stock ?? ""}</td>
      <td>
        <button class="btn btn-sm btn-secondary edit-btn">Edit</button>
        <button class="btn btn-sm btn-danger delete-btn">Delete</button>
      </td>
    `;

    tr.querySelector(".edit-btn").addEventListener("click", () => {
      fillFormWithProduct(p);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    tr.querySelector(".delete-btn").addEventListener("click", async () => {
      if (!confirm("Delete this product?")) return;
      try {
        await fetchJson(`${API_BASE}/api/admin/products/${p._id}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
        });
        loadProducts();
      } catch (err) {
        alert("Delete failed: " + err.message);
      }
    });

    tbody.appendChild(tr);
  });
}

async function loadProducts() {
  const statusEl = document.getElementById("sellerStatus");
  try {
    const products = await fetchJson(`${API_BASE}/api/admin/products`, {
      headers: authHeaders(),
    });
    statusEl.textContent = `Seller access granted. Products: ${products.length}`;
    renderProductsTable(products);
  } catch (err) {
    console.error(err);
    if (String(err.message).includes("403")) {
      statusEl.textContent =
        "You are not authorized to access the seller panel (admin only).";
    } else if (String(err.message).includes("401")) {
      statusEl.textContent = "Please login first to use the seller panel.";
    } else {
      statusEl.textContent = "Failed to load products.";
    }
    const tbody = document.getElementById("productsTableBody");
    tbody.innerHTML = `<tr><td colspan="6">Unable to load products.</td></tr>`;
  }
}

function parseCsv(text) {
  // Very simple CSV parser (no quoted commas support)
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}

async function uploadCsv(file) {
  const statusEl = document.getElementById("csvStatus");
  statusEl.textContent = "Reading file...";
  const text = await file.text();
  const rows = parseCsv(text);

  if (!rows.length) {
    statusEl.textContent = "No rows found in CSV.";
    return;
  }

  statusEl.textContent = `Parsed ${rows.length} rows. Uploading...`;

  try {
    await fetchJson(`${API_BASE}/api/admin/products/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({ rows }),
    });
    statusEl.textContent = `Uploaded ${rows.length} products.`;
    loadProducts();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Bulk upload failed: " + err.message;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Load existing products
  loadProducts();

  // Form submit
  document
    .getElementById("productForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const statusEl = document.getElementById("sellerStatus");

      const payload = productPayloadFromForm();
      const id = document.getElementById("productId").value;

      try {
        if (id) {
          // update
          await fetchJson(`${API_BASE}/api/admin/products/${id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...authHeaders(),
            },
            body: JSON.stringify(payload),
          });
          statusEl.textContent = "Product updated.";
        } else {
          // create
          await fetchJson(`${API_BASE}/api/admin/products`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...authHeaders(),
            },
            body: JSON.stringify(payload),
          });
          statusEl.textContent = "Product created.";
        }
        resetForm();
        loadProducts();
      } catch (err) {
        console.error(err);
        statusEl.textContent = "Save failed: " + err.message;
      }
    });
      // Image file -> base64 -> image input
  const imageFileInput = document.getElementById("imageFile");
  if (imageFileInput) {
    imageFileInput.addEventListener("change", () => {
      const file = imageFileInput.files && imageFileInput.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        // jo URL field hai usme base64 string daal do
        document.getElementById("image").value = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }


  document
    .getElementById("resetFormBtn")
    .addEventListener("click", () => resetForm());

  // CSV upload
  document
    .getElementById("uploadCsvBtn")
    .addEventListener("click", async () => {
      const input = document.getElementById("csvFileInput");
      if (!input.files || !input.files[0]) {
        alert("Please choose a CSV file first.");
        return;
      }
      await uploadCsv(input.files[0]);
    });
});
