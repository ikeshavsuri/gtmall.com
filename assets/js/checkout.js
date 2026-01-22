// ================= CONFIG =================

// 🔁 Backend URL (Render wala URL yahan daalo)
const BACKEND_URL = API_BASE; 
// API_BASE already api.js se aa raha hai

// 🔑 Razorpay KEY ID (sirf KEY ID, secret nahi)
const RAZORPAY_KEY_ID = "rzp_live_S6wB5LeTtqAAik"; 
// 👆 apni LIVE key id yahan daalo


// ================= HELPERS =================

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

// ================= MAIN =================

document.addEventListener("DOMContentLoaded", () => {

  const itemsList  = document.getElementById("checkoutItemsList");
  const subtotalEl = document.getElementById("checkoutSubtotal");
  const totalEl    = document.getElementById("checkoutTotal");
  const payNowBtn  = document.getElementById("btnPayNow");

  let cart = getCartItems();
  let subtotal = 0;

  // ---------- EMPTY CART ----------
  if (!cart.length) {
    itemsList.innerHTML = `<li class="list-group-item">Your cart is empty.</li>`;
    subtotalEl.textContent = "₹0";
    totalEl.textContent = "₹0";
    payNowBtn.disabled = true;
    return;
  }

  // ---------- RENDER CART ----------
  itemsList.innerHTML = "";
  cart.forEach(item => {
    const qty = Number(item.quantity || 1);
    const price = Number(item.price || 0);
    const lineTotal = price * qty;
    subtotal += lineTotal;

    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between";
    li.innerHTML = `
      <div>${item.name}</div>
      <strong>₹${lineTotal.toFixed(2)}</strong>
    `;
    itemsList.appendChild(li);
  });

  subtotalEl.textContent = "₹" + subtotal.toFixed(2);
  totalEl.textContent = "₹" + subtotal.toFixed(2);

  // ================= PAY NOW =================

  payNowBtn.addEventListener("click", async () => {

    // ---------- ADDRESS ----------
    const address = {
      name: document.getElementById("addrName")?.value.trim(),
      mobile: document.getElementById("addrMobile")?.value.trim(),
      email: document.getElementById("addrEmail")?.value.trim(),
      pincode: document.getElementById("addrPincode")?.value.trim(),
      locality: document.getElementById("addrLocality")?.value.trim(),
      areaStreet: document.getElementById("addrAreaStreet")?.value.trim(),
      city: document.getElementById("addrCity")?.value.trim(),
      state: document.getElementById("addrState")?.value.trim(),
    };

    if (
      !address.name ||
      !address.mobile ||
      address.mobile.length !== 10 ||
      !address.email ||
      !address.pincode ||
      !address.locality ||
      !address.areaStreet ||
      !address.city ||
      !address.state
    ) {
      alert("Please fill all required address fields correctly.");
      return;
    }

    try {
      payNowBtn.disabled = true;
      payNowBtn.textContent = "Processing...";

      // ---------- 1️⃣ CREATE ORDER (BACKEND) ----------
      const orderRes = await fetch(
        `${BACKEND_URL}/api/payment/create-order`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify({ amount: subtotal }),
        }
      );

      const order = await orderRes.json();
      if (!order.id) {
        throw new Error("Order creation failed");
      }

      // ---------- 2️⃣ RAZORPAY OPTIONS ----------
      const options = {
        key: RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: "INR",
        name: "GT Mall",
        description: "Order Payment",
        order_id: order.id,

        handler: async function (response) {

          // ---------- 3️⃣ VERIFY PAYMENT ----------
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

            const modalEl = document.getElementById("orderSuccessModal");
            if (modalEl && bootstrap?.Modal) {
              document.getElementById("successOrderId").textContent =
                response.razorpay_order_id;
              new bootstrap.Modal(modalEl).show();
            } else {
              alert("Payment successful 🎉");
            }
          } else {
            alert("Payment verification failed ❌");
          }
        },

        theme: {
          color: "#198754",
        },
      };

      // ---------- 4️⃣ OPEN RAZORPAY ----------
      const rzp = new Razorpay(options);
      rzp.open();

    } catch (err) {
      console.error(err);
      alert("Unable to start payment. Please try again.");
      payNowBtn.disabled = false;
      payNowBtn.textContent = "Proceed to Payment";
    }
  });

  // ---------- TRACK ORDER ----------
  const trackBtn = document.getElementById("btnTrackOrder");
  if (trackBtn) {
    trackBtn.addEventListener("click", () => {
      window.location.href = "my_orders.html";
    });
  }
});
