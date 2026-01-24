// =====================================================
//  ADMIN ORDERS DASHBOARD – FINAL VERSION
//  Razorpay + Refund + Print Label + Filters
// =====================================================

// globals
let ADMIN_ORDERS = [];
let FILTERED_ORDERS = [];
let CURRENT_ORDER_FOR_PRINT = null;

// -----------------------------------------------------
// Helpers
// -----------------------------------------------------
function formatDateTime(dtStr) {
  if (!dtStr) return "";
  return new Date(dtStr).toLocaleString();
}

function shortAddress(address = {}) {
  const parts = [];
  if (address.areaStreet) parts.push(address.areaStreet);
  if (address.locality) parts.push(address.locality);
  if (address.city) parts.push(address.city);
  if (address.state) parts.push(address.state);
  if (address.pin) parts.push(address.pin);
  return parts.join(", ");
}

// -----------------------------------------------------
// Stats
// -----------------------------------------------------
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

// -----------------------------------------------------
// Filters
// -----------------------------------------------------
function applyFilters() {
  const statusVal = document.getElementById("filterStatus")?.value || "";
  const daysVal = Number(document.getElementById("filterDays")?.value || 0);
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
      if (!id.includes(searchVal) && !email.includes(searchVal)) return false;
    }

    return true;
  });

  renderOrdersTable();
}

// -----------------------------------------------------
// Orders Table
// -----------------------------------------------------
function renderOrdersTable() {
  const tbody = document.getElementById("ordersTableBody");
  tbody.innerHTML = "";

  if (!FILTERED_ORDERS.length) {
    tbody.innerHTML =
      "<tr><td colspan='10' class='text-center'>No orders found.</td></tr>";
    return;
  }

  FILTERED_ORDERS.forEach((o, index) => {
    const tr = document.createElement("tr");

    const itemsPreview =
      o.items && o.items.length
        ? (o.items[0].name || "Item") +
          (o.items.length > 1 ? ` +${o.items.length - 1} more` : "")
        : "-";

    // payment badge
    let paymentBadge = "<span class='badge bg-warning text-dark'>Pending</span>";
    if (o.paymentStatus === "paid")
      paymentBadge = "<span class='badge bg-success'>Paid</span>";
    else if (o.paymentStatus === "refunded")
      paymentBadge = "<span class='badge bg-danger'>Refunded</span>";

    // refund badge + action
    let refundHtml = `<span class="badge badge-refund-none">N/A</span>`;
    let refundBtn = "";

    if (o.refundStatus === "requested") {
      refundHtml =
        `<span class="badge badge-refund-requested">Requested</span>`;
      refundBtn = `
        <button class="btn btn-sm btn-danger btn-refund-approve mt-1"
          data-id="${o._id}">
          Approve
        </button>`;
    } else if (o.refundStatus === "processed") {
      refundHtml =
        `<span class="badge badge-refund-processed">Completed</span><br/>
         <small>${o.refundId || ""}</small>`;
    }

    tr.innerHTML = `
      <td>
        <button class="btn btn-link p-0 admin-order-detail" data-index="${index}">
          #${o._id}
        </button>
      </td>
      <td>${o.userEmail || "-"}</td>
      <td>${formatDateTime(o.createdAt)}</td>
      <td>₹${o.amount || 0}</td>
      <td>${itemsPreview}</td>
      <td><small>${shortAddress(o.address)}</small></td>
      <td>
        ${paymentBadge}<br/>
        <small>${o.paymentId || ""}</small>
      </td>
      <td>${o.status || "-"}</td>
      <td>
        ${refundHtml}
        ${refundBtn}
      </td>
      <td>
        <button class="btn btn-sm btn-outline-primary admin-order-detail"
          data-index="${index}">
          View / Print
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // detail modal
  tbody.querySelectorAll(".admin-order-detail").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.index);
      openOrderDetail(FILTERED_ORDERS[idx]);
    });
  });

  // refund approve
  tbody.querySelectorAll(".btn-refund-approve").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const orderId = btn.dataset.id;
      if (!confirm("Approve refund for this order?")) return;

      try {
        btn.disabled = true;
        btn.textContent = "Processing...";

        const res = await fetch(
          API_BASE + `/api/admin/orders/${orderId}/refund`,
          {
            method: "POST",
            headers: authHeaders(),
          }
        );

        if (!res.ok) throw new Error("Refund failed");

        await loadOrders();
      } catch (err) {
        alert("Refund failed");
        console.error(err);
      }
    });
  });
}

// -----------------------------------------------------
// Order Detail Modal
// -----------------------------------------------------
function buildOrderDetailHtml(order) {
  const addr = order.address || {};
  const itemsRows = (order.items || [])
    .map(
      (it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${it.name || "Item"}</td>
      <td class="text-center">${it.quantity || 1}</td>
      <td class="text-end">₹${it.price || 0}</td>
      <td class="text-end">₹${
        (it.price || 0) * (it.quantity || 1)
      }</td>
    </tr>`
    )
    .join("");

  return `
    <p><strong>Payment:</strong> ${order.paymentStatus}</p>
    <p><strong>Refund:</strong> ${order.refundStatus || "N/A"}</p>
    <p><strong>Address:</strong><br/>
      ${addr.name || ""}<br/>
      ${shortAddress(addr)}<br/>
      Mobile: ${addr.mobile || ""}
    </p>

    <table class="table table-sm">
      <thead>
        <tr>
          <th>#</th><th>Item</th><th>Qty</th>
          <th class="text-end">Price</th>
          <th class="text-end">Total</th>
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>
  `;
}

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

// -----------------------------------------------------
// Print Label
// -----------------------------------------------------
function setupPrintButton() {
  const btn = document.getElementById("btnPrintLabel");
  if (!btn) return;

  btn.addEventListener("click", () => {
    if (!CURRENT_ORDER_FOR_PRINT) return;
    window.print();
  });
}

// -----------------------------------------------------
// Load Orders
// -----------------------------------------------------
async function loadOrders() {
  const status = document.getElementById("adminStatus");
  status.textContent = "Loading orders...";
  status.className = "badge bg-secondary";

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
}

// -----------------------------------------------------
// Init
// -----------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  await loadOrders();

  ["filterStatus", "filterDays", "filterSearch"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", applyFilters);
  });

  setupPrintButton();
});
