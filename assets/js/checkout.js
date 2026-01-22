// ================= CONFIG =================

const BACKEND_URL = API_BASE;

// 🔑 Razorpay KEY ID (sirf KEY ID)
const RAZORPAY_KEY_ID = "rzp_live_S6wB5LeTtqAAik";

// ================= GLOBAL =================
let selectedAddress = null;

// ================= HELPERS =================

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: "Bearer " + token } : {};
}

function getCartItems() {
  try {
    return JSON.parse(localStorage.getItem("cartItems") || "[]");
  } catch {
    return [];
  }
}

function clearCart() {
  localStorage.removeItem("cartItems");
  localStorage.removeItem("buyNowItem");
}

// ================= ADDRESS =================

async function loadAddresses() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/addresses`, {
      headers: authHeaders(),
    });
    const addresses = await res.json();

    if (!Array.isArray(addresses) || !addresses.length) return;

    renderAddresses(addresses);
  } catch (err) {
    console.error("Load address error:", err);
  }
}

function renderAddresses(addresses) {
  const container = document.getElementById("addressList");
  if (!container) return;

  container.innerHTML = "";
  selectedAddress = null;

  addresses.forEach((addr) => {
    const div = document.createElement("div");
    div.className = "border rounded p-2 mb-2";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "selectedAddress";
    radio.className = "form-check-input me-2";

    if (addr.isDefault && !selectedAddress) {
      radio.checked = true;
      selectedAddress = addr;
    }

    radio.addEventListener("change", () => {
      selectedAddress = addr;
    });

    div.appendChild(radio);
    div.appendChild(
      document.createTextNode(
        `${addr.name}, ${addr.mobile}, ${addr.areaStreet}, ${addr.city}, ${addr.state} - ${addr.pin}`
      )
    );

    container.appendChild(div);
  });

  // fallback: first address select
  if (!selectedAddress && addresses.length) {
    selectedAddress = addresses[0];
    const firstRadio = container.querySelector("input[type=radio]");
    if (firstRadio) firstRadio.checked = true;
  }
}

// ================= MAIN =================

document.addEventListener("DOMContentLoaded", () => {

  loadAddresses(); // ⭐ AUTO LOAD ADDRESS

  const itemsList = document.getElementById("checkoutItemsList");
  const subtotalEl = document.getElementById("checkoutSubtotal");
  const totalEl = document.getElementById("checkoutTotal");
  const payNowBtn = document.getElementById("btnPayNow");

  const cart = getCartItems();
  let subtotal = 0;

  if (!cart.length) {
    itemsList.innerHTML = `<li class="list-group-item">Your cart is empty.</li>`;
    payNowBtn.disabled = true;
    return;
  }

  cart.forEach((item) => {
    const qty = Number(item.quantity || 1);
    const price = Number(item.price || 0);
    subtotal += price * qty;

    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between";
    li.innerHTML = `<div>${item.name}</div><strong>₹${(price * qty).toFixed(2)}</strong>`;
    itemsList.appendChild(li);
  });

  subtotalEl.textContent = "₹" + subtotal.toFixed(2);
  totalEl.textContent = "₹" + subtotal.toFixed(2);

  // ================= PAY =================

  payNowBtn.addEventListener("click", async () => {

    if (!selectedAddress) {
      alert("Please select delivery address");
      return;
    }

    try {
      payNowBtn.disabled = true;
      payNowBtn.textContent = "Processing...";

      // 1️⃣ CREATE ORDER
      const orderRes = await fetch(`${BACKEND_URL}/api/payment/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ amount: subtotal }),
      });

      const order = await orderRes.json();
      if (!order.id) throw new Error("Order creation failed");

      // 2️⃣ RAZORPAY
      const options = {
        key: RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: "INR",
        name: "GT Mall",
        order_id: order.id,

        handler: async function (response) {
          const verifyRes = await fetch(
            `${BACKEND_URL}/api/payment/verify-payment`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...authHeaders(),
              },
              body: JSON.stringify(response),
            }
          );

          const result = await verifyRes.json();
          if (result.status === "success") {
            clearCart();
            alert("Payment successful 🎉");
            window.location.href = "my_orders.html";
          } else {
            alert("Payment verification failed");
          }
        },

        theme: { color: "#198754" },
      };

      new Razorpay(options).open();

    } catch (err) {
      console.error(err);
      alert("Payment failed");
      payNowBtn.disabled = false;
      payNowBtn.textContent = "Proceed to Payment";
    }
  });
});
