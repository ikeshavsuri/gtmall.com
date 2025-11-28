// assets/js/admin.js
// Simple admin dashboard to show all orders

document.addEventListener("DOMContentLoaded", async () => {
  const statusBadge = document.getElementById("adminStatus");
  const tbody = document.getElementById("ordersTableBody");

  if (!statusBadge || !tbody) return;

  const setStatus = (text, type = "secondary") => {
    statusBadge.textContent = text;
    statusBadge.className = "badge bg-" + type;
  };

  try {
    // Fetch all orders as admin
    const res = await fetch(API_BASE + "/api/admin/orders", {
      headers: authHeaders(),
    });

    if (res.status === 401) {
      setStatus("Please login first", "warning");
      tbody.innerHTML = "<tr><td colspan='8' class='text-center'>Login required. Please login with admin account.</td></tr>";
      return;
    }
    if (res.status === 403) {
      setStatus("Access denied (not admin)", "danger");
      tbody.innerHTML = "<tr><td colspan='8' class='text-center'>You are not allowed to view this page.</td></tr>";
      return;
    }
    if (!res.ok) {
      setStatus("Failed to load", "danger");
      tbody.innerHTML = "<tr><td colspan='8' class='text-center'>Failed to load orders.</td></tr>";
      return;
    }

    const orders = await res.json();
    if (!orders.length) {
      setStatus("No orders yet", "info");
      tbody.innerHTML = "<tr><td colspan='8' class='text-center'>No orders placed yet.</td></tr>";
      return;
    }

    setStatus(`Total Orders: ${orders.length}`, "success");
    tbody.innerHTML = "";

    orders.forEach((o) => {
      const tr = document.createElement("tr");

      const itemsHtml = (o.items || [])
        .map((item) => {
          const qty = item.quantity || 1;
          const price = Number(item.price) || 0;
          const lineTotal = qty * price;
          return `${item.name || ""} (x${qty}) - ₹${lineTotal}`;
        })
        .join("<br>");

      const addr = o.address || {};
      const addressLines = [
        addr.name,
        addr.phone,
        [addr.addressLine1, addr.addressLine2].filter(Boolean).join(", "),
        [addr.city, addr.state, addr.pincode].filter(Boolean).join(" - "),
        addr.landmark,
      ]
        .filter(Boolean)
        .join("<br>");

      const paymentStatus = o.paymentStatus || "created";
      const paymentBadge =
        paymentStatus === "paid"
          ? "<span class='badge bg-success'>Paid</span>"
          : paymentStatus === "failed"
          ? "<span class='badge bg-danger'>Failed</span>"
          : "<span class='badge bg-warning text-dark'>" + paymentStatus + "</span>";

      tr.innerHTML = `
        <td>${o._id}</td>
        <td>
          <strong>${o.userEmail || ""}</strong><br/>
          <small>${o.userId || ""}</small>
        </td>
        <td>${o.createdAt ? new Date(o.createdAt).toLocaleString() : ""}</td>
        <td>₹${o.amount || 0}</td>
        <td>${itemsHtml}</td>
        <td>${addressLines || "-"}</td>
        <td>
          ${paymentBadge}<br/>
          <small>${o.paymentId || ""}</small>
        </td>
        <td>${o.status || ""}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Admin dashboard error:", err);
    setStatus("Error loading", "danger");
    tbody.innerHTML = "<tr><td colspan='8' class='text-center'>Unexpected error while loading orders.</td></tr>";
  }
});
