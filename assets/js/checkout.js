const API_BASE = "https://gtmall-com.onrender.com";
const RAZORPAY_KEY_ID = "rzp_test_RjWvj3SadohBEe"; // TODO: put your test key

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "x-user-id": localStorage.getItem("userUid") || "",
    "x-user-email": localStorage.getItem("userEmail") || "",
    "x-user-name": localStorage.getItem("userName") || ""
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const itemsList   = document.getElementById("checkoutItemsList");
  const subtotalEl  = document.getElementById("checkoutSubtotal");
  const totalEl     = document.getElementById("checkoutTotal");
  const payNowBtn   = document.getElementById("btnPayNow");

  let cart = [];
  try {
    cart = JSON.parse(localStorage.getItem("cartItems") || "[]");
  } catch {
    cart = [];
  }

  let subtotal = 0;
  if (!cart.length) {
    if (itemsList) itemsList.innerHTML = '<li class="list-group-item">Your cart is empty.</li>';
    if (subtotalEl) subtotalEl.textContent = "₹0";
    if (totalEl) totalEl.textContent = "₹0";
    if (payNowBtn) {
      payNowBtn.disabled = true;
      payNowBtn.textContent = "Cart is empty";
    }
    return;
  }

  if (itemsList) {
    itemsList.innerHTML = "";
    cart.forEach(item => {
      const line = (item.price || 0) * (item.quantity || 1);
      subtotal += line;
      const li = document.createElement("li");
      li.className = "list-group-item d-flex justify-content-between";
      li.innerHTML = `<span>${item.name}</span><strong>₹${line}</strong>`;
      itemsList.appendChild(li);
    });
  }
  if (subtotalEl) subtotalEl.textContent = "₹" + subtotal;
  if (totalEl) totalEl.textContent = "₹" + subtotal;

  if (payNowBtn) {
    payNowBtn.addEventListener("click", async () => {
      const name      = document.getElementById("addrName")?.value.trim();
      const mobile    = document.getElementById("addrMobile")?.value.trim();
      const email     = document.getElementById("addrEmail")?.value.trim();
      const pin       = document.getElementById("addrPincode")?.value.trim();
      const locality  = document.getElementById("addrLocality")?.value.trim();
      const areaStreet= document.getElementById("addrAreaStreet")?.value.trim();
      const city      = document.getElementById("addrCity")?.value.trim();
      const state     = document.getElementById("addrState")?.value.trim();
      const landmark  = document.getElementById("addrLandmark")?.value.trim();
      const altMobile = document.getElementById("addrAltMobile")?.value.trim();
      const addrType  = document.querySelector("input[name='addrType']:checked")?.value || "Home";

      if (!name || !mobile || mobile.length !== 10 ||
          !pin || !locality || !areaStreet || !city || !state || !email) {
        alert("Please fill all required address fields.");
        return;
      }

      const address = { name, mobile, altMobile, email, pin, locality, areaStreet, city, state, landmark, type: addrType };

      try {
        payNowBtn.disabled = true;
        payNowBtn.textContent = "Creating order...";

        const res = await fetch(API_BASE + "/api/payment/create-order", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ amount: subtotal })
        });
        const order = await res.json();
        if (!order.id) throw new Error("Order creation failed");

        const options = {
          key: RAZORPAY_KEY_ID,
          amount: order.amount,
          currency: order.currency,
          name: "GT Mall",
          description: "Order payment",
          order_id: order.id,
          prefill: { name, email, contact: mobile },
          handler: async function (response) {
            try {
              const verifyRes = await fetch(API_BASE + "/api/payment/verify", {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  address,
                  cartItems: cart
                })
              });
              const data = await verifyRes.json();
              if (!data.success) throw new Error("Verification failed");
              localStorage.removeItem("cartItems");
              const idSpan = document.getElementById("successOrderId");
              if (idSpan) idSpan.textContent = data.orderId || "";
              const modalEl = document.getElementById("orderSuccessModal");
              if (modalEl && window.bootstrap) {
                const m = new bootstrap.Modal(modalEl);
                m.show();
              } else {
                window.location.href = "my_orders.html";
              }
            } catch (err) {
              alert("Payment done but something went wrong saving your order. Contact support.");
            } finally {
              payNowBtn.disabled = false;
              payNowBtn.textContent = "Proceed to Payment";
            }
          },
          theme: { color: "#0a8239" }
        };
        const rzp = new Razorpay(options);
        rzp.open();
      } catch (e) {
        console.error(e);
        alert("Unable to start payment. Please try again.");
        payNowBtn.disabled = false;
        payNowBtn.textContent = "Proceed to Payment";
      }
    });
  }

  const trackBtn = document.getElementById("btnTrackOrder");
  trackBtn?.addEventListener("click", () => {
    window.location.href = "my_orders.html";
  });
});
