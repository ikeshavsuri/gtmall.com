
// assets/js/admin.js
// Admin orders dashboard with filters, detail modal and shipping label print.

let ADMIN_ORDERS = [];
let FILTERED_ORDERS = [];
let CURRENT_ORDER_FOR_PRINT = null;

function formatDateTime(dtStr) {
  if (!dtStr) return "";
  const d = new Date(dtStr);
  return d.toLocaleString();
}

function shortAddress(address) {
  if (!address) return "";
  const parts = [];
  if (address.areaStreet) parts.push(address.areaStreet);
  if (address.locality) parts.push(address.locality);
  if (address.city) parts.push(address.city);
  if (address.state) parts.push(address.state);
  if (address.pin) parts.push(address.pin);
  return parts.join(", ");
}

function computeStats(orders) {
  const total = orders.length;
  let processing = 0;
  let shipped = 0;
  let delivered = 0;

  const now = new Date();
  const thirtyAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  orders.forEach((o) => {
    if (o.status === "Processing") processing++;
    else if (o.status === "Shipped") shipped++;
    else if (o.status === "Delivered") {
      // only last 30 days for delivered card
      const created = new Date(o.createdAt || now);
      if (created >= thirtyAgo) delivered++;
    }
  });

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(val);
  };

  set("statTotal", total);
  set("statProcessing", processing);
  set("statShipped", shipped);
  set("statDelivered", delivered);
}

function applyFilters() {
  const statusSelect = document.getElementById("filterStatus");
  const daysSelect = document.getElementById("filterDays");
  const searchInput = document.getElementById("filterSearch");

  const statusVal = statusSelect ? statusSelect.value : "";
  const daysVal = daysSelect ? parseInt(daysSelect.value || "0", 10) : 0;
  const searchVal = (searchInput ? searchInput.value : "").trim().toLowerCase();

  const now = new Date();
  const minDate =
    daysVal > 0
      ? new Date(now.getTime() - daysVal * 24 * 60 * 60 * 1000)
      : null;

  FILTERED_ORDERS = ADMIN_ORDERS.filter((o) => {
    if (statusVal && o.status !== statusVal) return false;

    if (minDate) {
      const created = new Date(o.createdAt || now);
      if (created < minDate) return false;
    }

    if (searchVal) {
      const id = (o._id || "").toLowerCase();
      const email = (o.userEmail || o.email || "").toLowerCase();
      if (!id.includes(searchVal) && !email.includes(searchVal)) return false;
    }

    return true;
  });

  renderOrdersTable();
}

function renderOrdersTable() {
  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!FILTERED_ORDERS.length) {
    tbody.innerHTML =
      "<tr><td colspan='9' class='text-center'>No orders found for selected filters.</td></tr>";
    return;
  }

  FILTERED_ORDERS.forEach((o, index) => {
    const tr = document.createElement("tr");

    const addrText = shortAddress(o.address || {});
    const itemsPreview =
      (o.items && o.items.length
        ? (o.items[0].name ||
            o.items[0].title ||
            o.items[0].productName ||
            "Item") +
          (o.items.length > 1 ? " +" + (o.items.length - 1) + " more" : "")
        : "") || "-";

    const paymentBadge =
      o.paymentStatus === "Paid"
        ? "<span class='badge bg-success'>Paid</span>"
        : "<span class='badge bg-warning text-dark'>Pending</span>";

    tr.innerHTML = `
      <td>
        <button class="btn btn-link p-0 admin-order-detail" data-index="${index}">
          #${o._id}
        </button>
      </td>
      <td>
        <div>${o.userEmail || o.email || "-"}</div>
        <small class="text-muted">${o.userName || ""}</small>
      </td>
      <td>${formatDateTime(o.createdAt)}</td>
      <td>₹${o.amount || 0}</td>
      <td>${itemsPreview}</td>
      <td>
        <small>${addrText || "-"}</small>
      </td>
      <td>
        ${paymentBadge}<br/>
        <small>${o.paymentId || ""}</small>
      </td>
      <td>${o.status || "-"}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary admin-order-detail" data-index="${index}">
          View / Print
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Attach detail handlers
  tbody.querySelectorAll(".admin-order-detail").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const idx = parseInt(btn.getAttribute("data-index") || "0", 10);
      const order = FILTERED_ORDERS[idx];
      if (order) {
        openOrderDetail(order);
      }
    });
  });
}

function buildOrderDetailHtml(order) {
  const addr = order.address || {};
  const addressHtml = `
    <strong>${addr.name || ""}</strong><br/>
    ${(addr.areaStreet || "")}${addr.locality ? ", " + addr.locality : ""}<br/>
    ${(addr.city || "")}${addr.state ? ", " + addr.state : ""}${
    addr.pin ? " - " + addr.pin : ""
  }<br/>
    Mobile: ${addr.mobile || ""}${
    addr.altMobile ? " / " + addr.altMobile : ""
  }
  `;

  const itemsRows = (order.items || [])
    .map((item, idx) => {
      const name =
        item.name || item.title || item.productName || "Product " + (idx + 1);
      const qty = item.quantity || 1;
      const price = item.price || 0;
      const lineTotal = qty * price;
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${name}</td>
          <td class="text-center">${qty}</td>
          <td class="text-end">₹${price}</td>
          <td class="text-end">₹${lineTotal}</td>
        </tr>
      `;
    })
    .join("");

  const subTotal =
    (order.items || []).reduce(
      (sum, it) => sum + (it.price || 0) * (it.quantity || 1),
      0
    ) || order.amount || 0;

  const expectedDate = (() => {
    const d = new Date(order.createdAt || Date.now());
    d.setDate(d.getDate() + 7);
    return d.toDateString();
  })();

  return `
    <div class="mb-3">
      <div class="d-flex justify-content-between flex-wrap">
        <div>
          <h6 class="mb-1">Order ID</h6>
          <p class="mb-0"><strong>#${order._id}</strong></p>
          <small class="text-muted">Placed: ${formatDateTime(
            order.createdAt
          )}</small>
        </div>
        <div class="text-md-end mt-2 mt-md-0">
          <h6 class="mb-1">Payment</h6>
          <p class="mb-0">${
            order.paymentStatus === "Paid"
              ? "<span class='badge bg-success'>Paid</span>"
              : "<span class='badge bg-warning text-dark'>Pending</span>"
          }</p>
          <small class="text-muted">${
            order.paymentId ? "Txn: " + order.paymentId : ""
          }</small>
        </div>
      </div>
    </div>

    <div class="row g-3 mb-3">
      <div class="col-md-6">
        <h6>Shipping Address</h6>
        <p class="mb-0 small">
          ${addressHtml}
        </p>
      </div>
      <div class="col-md-6">
        <h6>Order Summary</h6>
        <p class="mb-1 small"><strong>Status:</strong> ${
          order.status || "Processing"
        }</p>
        <p class="mb-1 small"><strong>Amount:</strong> ₹${order.amount || 0}</p>
        <p class="mb-0 small"><strong>Expected delivery:</strong> ${expectedDate}</p>
      </div>
    </div>

    <h6>Items</h6>
    <div class="table-responsive mb-3">
      <table class="table table-sm align-middle">
        <thead class="table-light">
          <tr>
            <th>#</th>
            <th>Product</th>
            <th class="text-center">Qty</th>
            <th class="text-end">Price</th>
            <th class="text-end">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
        <tfoot>
          <tr>
            <th colspan="4" class="text-end">Subtotal</th>
            <th class="text-end">₹${subTotal}</th>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

function buildPrintWindowHtml(order) {
  const addr = order.address || {};
  const addressHtml = `
    <strong>${addr.name || ""}</strong><br/>
    ${(addr.areaStreet || "")}${addr.locality ? ", " + addr.locality : ""}<br/>
    ${(addr.city || "")}${addr.state ? ", " + addr.state : ""}${
    addr.pin ? " - " + addr.pin : ""
  }<br/>
    Mobile: ${addr.mobile || ""}${
    addr.altMobile ? " / " + addr.altMobile : ""
  }
  `;

  const itemsRows = (order.items || [])
    .map((item, idx) => {
      const name =
        item.name || item.title || item.productName || "Product " + (idx + 1);
      const qty = item.quantity || 1;
      const price = item.price || 0;
      const lineTotal = qty * price;
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${name}</td>
          <td>${qty}</td>
          <td>₹${price}</td>
          <td>₹${lineTotal}</td>
        </tr>
      `;
    })
    .join("");

  const subTotal =
    (order.items || []).reduce(
      (sum, it) => sum + (it.price || 0) * (it.quantity || 1),
      0
    ) || order.amount || 0;

  const expectedDate = (() => {
    const d = new Date(order.createdAt || Date.now());
    d.setDate(d.getDate() + 7);
    return d.toDateString();
  })();

  const trackingId = order._id || "";
  const today = new Date();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Shipping Label - #${order._id}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 16px; }
    .label-wrapper { border: 1px dashed #000; padding: 12px; margin-bottom: 16px; }
    .section-title { font-weight: bold; margin-bottom: 4px; }
    .small-text { font-size: 12px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid #000; padding: 4px; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .mt-2 { margin-top: 8px; }
    .mt-3 { margin-top: 12px; }
  </style>
</head>
<body>
  <div class="label-wrapper">
    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
      <div>
        <div class="section-title">DELIVERY ADDRESS</div>
        <div class="small-text">
          ${addressHtml}
        </div>
      </div>
      <div style="text-align:right; font-size:12px;">
        <div><strong>Order ID:</strong> #${order._id}</div>
        <div><strong>Tracking ID:</strong> ${trackingId}</div>
        <div><strong>Order Date:</strong> ${today.toDateString()}</div>
        <div><strong>Expected Delivery:</strong> ${expectedDate}</div>
      </div>
    </div>

    <div class="mt-3">
      <div class="section-title">Items</div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Product</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
        <tfoot>
          <tr>
            <th colspan="4" class="text-right">Total</th>
            <th class="text-right">₹${subTotal}</th>
          </tr>
        </tfoot>
      </table>
    </div>

    <div class="mt-3 small-text">
      <strong>Declaration:</strong> The goods sold are intended for end user consumption and not for resale.
    </div>
  </div>

  <div class="small-text">
    Printed from GT Mall Admin Panel.
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
  `;
}

function openOrderDetail(order) {
  CURRENT_ORDER_FOR_PRINT = order;
  const bodyEl = document.getElementById("orderDetailBody");
  const titleEl = document.getElementById("orderDetailTitle");
  if (!bodyEl || !titleEl) return;

  titleEl.textContent = "Order #" + (order._id || "");
  bodyEl.innerHTML = buildOrderDetailHtml(order);

  const modalEl = document.getElementById("orderDetailModal");
  if (!modalEl) return;
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

function setupPrintButton() {
  const btn = document.getElementById("btnPrintLabel");
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (!CURRENT_ORDER_FOR_PRINT) return;
    const html = buildPrintWindowHtml(CURRENT_ORDER_FOR_PRINT);
    const w = window.open("", "_blank");
    if (!w) {
      alert("Popup blocked. Please allow popups to print the label.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const statusBadge = document.getElementById("adminStatus");
  if (!statusBadge) return;

  const setStatus = (text, type = "secondary") => {
    statusBadge.textContent = text;
    statusBadge.className = "badge bg-" + type;
  };

  setStatus("Loading orders...", "secondary");

  try {
    const res = await fetch(API_BASE + "/api/admin/orders", {
      headers: authHeaders(),
    });
    if (!res.ok) {
      setStatus("Failed to load (" + res.status + ")", "danger");
      return;
    }
    const orders = await res.json();
    ADMIN_ORDERS = Array.isArray(orders) ? orders : [];
    FILTERED_ORDERS = ADMIN_ORDERS.slice();

    computeStats(ADMIN_ORDERS);
    applyFilters();
    setStatus("Loaded " + ADMIN_ORDERS.length + " orders", "success");
  } catch (err) {
    console.error("Admin dashboard error:", err);
    setStatus("Error loading", "danger");
    const tbody = document.getElementById("ordersTableBody");
    if (tbody) {
      tbody.innerHTML =
        "<tr><td colspan='9' class='text-center'>Unexpected error while loading orders.</td></tr>";
    }
  }

  // filters
  const statusSelect = document.getElementById("filterStatus");
  const daysSelect = document.getElementById("filterDays");
  const searchInput = document.getElementById("filterSearch");

  if (statusSelect) statusSelect.addEventListener("change", applyFilters);
  if (daysSelect) daysSelect.addEventListener("change", applyFilters);
  if (searchInput)
    searchInput.addEventListener("input", () => {
      // small debounce
      clearTimeout(searchInput._timer);
      searchInput._timer = setTimeout(applyFilters, 200);
    });

  setupPrintButton();
});
