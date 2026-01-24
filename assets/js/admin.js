// assets/js/admin.js
// Admin orders dashboard – Razorpay + Webhook compatible

let ADMIN_ORDERS = [];
let FILTERED_ORDERS = [];
let CURRENT_ORDER_FOR_PRINT = null;

function formatDateTime(dtStr) {
  if (!dtStr) return "";
  return new Date(dtStr).toLocaleString();
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

// --------------------
// Stats
// --------------------
function computeStats(orders) {
  let processing = 0,
    shipped = 0,
    delivered = 0;

  orders.forEach((o) => {
    if (o.status === "Processing") processing++;
    else if (o.status === "Shipped") shipped++;
    else if (o.status === "Delivered") delivered++;
  });

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  set("statTotal", orders.length);
  set("statProcessing", processing);
  set("statShipped", shipped);
  set("statDelivered", delivered);
}

// --------------------
// Filters
// --------------------
function applyFilters() {
  const statusVal =
    document.getElementById("filterStatus")?.value || "";
  const daysVal =
    Number(document.getElementById("filterDays")?.value || 0);
  const searchVal =
    document.getElementById("filterSearch")?.value
      .trim()
      .toLowerCase() || "";

  const now = new Date();
  const minDate =
    daysVal > 0
      ? new Date(now.getTime() - daysVal * 86400000)
      : null;

  FILTERED_ORDERS = ADMIN_ORDERS.filter((o) => {
    if (statusVal && o.status !== statusVal) return false;

    if (minDate) {
      const created = new Date(o.createdAt || now);
      if (created < minDate) return false;
    }

    if (searchVal) {
      const id = (o._id || "").toLowerCase();
      const email = (o.userEmail || "").toLowerCase();
      if (!id.includes(searchVal) && !email.includes(searchVal))
        return false;
    }

    return true;
  });

  renderOrdersTable();
}

// --------------------
// Orders Table
// --------------------
function renderOrdersTable() {
  const tbody = document.getElementById("ordersTableBody");
  tbody.innerHTML = "";

  if (!FILTERED_ORDERS.length) {
    tbody.innerHTML =
      "<tr><td colspan='9' class='text-center'>No orders found.</td></tr>";
    return;
  }

  FILTERED_ORDERS.forEach((o, index) => {
    const tr = document.createElement("tr");

    const itemsPreview =
      o.items?.[0]?.name +
        (o.items.length > 1 ? ` +${o.items.length - 1} more` : "") ||
      "-";

    const paymentBadge =
      o.paymentStatus === "paid"
        ? "<span class='badge bg-success'>Paid</span>"
        : "<span class='badge bg-warning text-dark'>Pending</span>";

    const refundBadge =
      o.refundStatus === "requested"
        ? "<span class='badge bg-danger ms-1'>Refund Requested</span>"
        : o.refundStatus === "processed"
        ? "<span class='badge bg-secondary ms-1'>Refunded</span>"
        : "";

    tr.innerHTML = `
      <td>
        <button class="btn btn-link p-0 admin-order-detail" data-index="${index}">
          #${o._id}
        </button>
      </td>
      <td>${o.userEmail || "-"}</td>
      <td>${formatDateTime(o.createdAt)}</td>
      <td>₹${o.amount}</td>
      <td>${itemsPreview}</td>
      <td><small>${shortAddress(o.address)}</small></td>
      <td>
        ${paymentBadge}
        ${refundBadge}
        <br/>
        <small>${o.paymentId || ""}</small>
      </td>
      <td>${o.status}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary admin-order-detail" data-index="${index}">
          View / Print
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".admin-order-detail").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.index);
      openOrderDetail(FILTERED_ORDERS[idx]);
    });
  });
}

// --------------------
// Order Detail Modal
// --------------------
function openOrderDetail(order) {
  CURRENT_ORDER_FOR_PRINT = order;
  document.getElementById("orderDetailTitle").textContent =
    "Order #" + order._id;
  document.getElementById("orderDetailBody").innerHTML =
    buildOrderDetailHtml(order);

  bootstrap.Modal.getOrCreateInstance(
    document.getElementById("orderDetailModal")
  ).show();
}

// --------------------
// Init
// --------------------
document.addEventListener("DOMContentLoaded", async () => {
  const status = document.getElementById("adminStatus");
  status.textContent = "Loading orders...";

  try {
    const res = await fetch(API_BASE + "/api/admin/orders", {
      headers: authHeaders(),
    });
    const orders = await res.json();

    ADMIN_ORDERS = Array.isArray(orders) ? orders : [];
    FILTERED_ORDERS = ADMIN_ORDERS.slice();

    computeStats(ADMIN_ORDERS);
    applyFilters();

    status.textContent = `Loaded ${ADMIN_ORDERS.length} orders`;
    status.className = "badge bg-success";
  } catch (err) {
    console.error(err);
    status.textContent = "Failed to load orders";
    status.className = "badge bg-danger";
  }

  ["filterStatus", "filterDays", "filterSearch"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", applyFilters);
  });

  setupPrintButton();
});
