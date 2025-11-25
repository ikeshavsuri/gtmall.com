// public/js/checkout.js

document.addEventListener("DOMContentLoaded", () => {
  const itemsList   = document.getElementById("checkoutItemsList");
  const subtotalEl  = document.getElementById("checkoutSubtotal");
  const totalEl     = document.getElementById("checkoutTotal");
  const payNowBtn   = document.getElementById("btnPayNow");

  // 1) Load cart from localStorage
  let cart = [];
  try {
    cart = JSON.parse(localStorage.getItem("cartItems") || "[]");
  } catch (err) {
    console.error("Cart parse error:", err);
    cart = [];
  }

  let subtotal = 0;

  if (!cart || cart.length === 0) {
    if (itemsList) {
      itemsList.innerHTML = `<li class="list-group-item">Your cart is empty.</li>`;
    }
    if (subtotalEl) subtotalEl.textContent = "₹0";
    if (totalEl) totalEl.textContent = "₹0";
    if (payNowBtn) {
      payNowBtn.disabled = true;
      payNowBtn.textContent = "Cart is empty";
    }
    return;
  }

  // 2) Render items + calculate subtotal
  if (itemsList) {
    itemsList.innerHTML = "";
    cart.forEach((item) => {
      const lineTotal = (item.price || 0) * (item.quantity || 1);
      subtotal += lineTotal;

      const li = document.createElement("li");
      li.className = "list-group-item d-flex justify-content-between";
      li.innerHTML = `
        <div>${item.name || "Product"}</div>
        <strong>₹${lineTotal.toFixed(2)}</strong>
      `;
      itemsList.appendChild(li);
    });
  }

  if (subtotalEl) subtotalEl.textContent = "₹" + subtotal.toFixed(2);
  if (totalEl) totalEl.textContent = "₹" + subtotal.toFixed(2);

  // 3) Handle Pay Now click
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

      // Basic validation
      if (!name || !mobile || mobile.length !== 10 ||
          !pin || pin.length < 4 ||
          !locality || !areaStreet || !city || !state || !email) {
        alert("Please fill all required address fields correctly.");
        return;
      }

      const address = {
        name,
        mobile,
        altMobile,
        email,
        pin,
        locality,
        areaStreet,
        city,
        state,
        landmark,
        type: addrType
      };

      // Save address for My Address page + navbar
      localStorage.setItem("lastAddress", JSON.stringify(address));
      localStorage.setItem("userEmail", email);
      if (!localStorage.getItem("userName")) {
        localStorage.setItem("userName", name);
      }

      // 3b) Create Razorpay order from backend
      try {
        payNowBtn.disabled = true;
        payNowBtn.textContent = "Creating Order...";

        const res = await fetch("/api/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: subtotal })
        });

        const order = await res.json();
        if (!order || !order.id) {
          console.error("Order response:", order);
          alert("Unable to create order. Please try again.");
          payNowBtn.disabled = false;
          payNowBtn.textContent = "Proceed to Payment";
          return;
        }

        // 3c) Razorpay options
        const options = {
          key: "RAZORPAY_KEY_ID_HERE", // 👈 yahan apna Razorpay key_id daalo
          amount: order.amount,
          currency: order.currency,
          name: "GT Mall",
          description: "Order Payment",
          order_id: order.id,
          prefill: {
            name: name,
            email: email,
            contact: mobile
          },
          notes: {
            address: `${areaStreet}, ${locality}, ${city} - ${pin}, ${state}`
          },
          theme: {
            color: "#0a8239"
          },
          handler: async function (response) {
            // 3d) Verify payment on backend
            try {
              const verifyRes = await fetch("/api/verify-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  address,
                  cartItems: cart
                })
              });

              const verifyData = await verifyRes.json();
              if (verifyData.success) {
                // Clear cart
                localStorage.removeItem("cartItems");

                // Save last order for My Orders page
                localStorage.setItem("lastOrder", JSON.stringify({
                  orderId: verifyData.orderId || order.id,
                  amount: subtotal,
                  date: new Date().toISOString(),
                  status: "Processing"
                }));

                // Show modal
                const orderIdEl = document.getElementById("successOrderId");
                if (orderIdEl) {
                  orderIdEl.textContent = verifyData.orderId || order.id;
                }
                const modalEl = document.getElementById("orderSuccessModal");
                if (modalEl && window.bootstrap) {
                  const modal = new bootstrap.Modal(modalEl);
                  modal.show();
                } else {
                  alert("Payment successful! Order ID: " + (verifyData.orderId || order.id));
                  window.location.href = "my_orders.html";
                }
              } else {
                alert("Payment verification failed. Please contact support.");
              }
            } catch (err) {
              console.error("Verify payment error:", err);
              alert("Something went wrong after payment. Please contact support.");
            } finally {
              payNowBtn.disabled = false;
              payNowBtn.textContent = "Proceed to Payment";
            }
          }
        };

        payNowBtn.disabled = false;
        payNowBtn.textContent = "Proceed to Payment";

        const rzp = new Razorpay(options);
        rzp.open();

      } catch (err) {
        console.error("Create order error:", err);
        alert("Unable to start payment. Please try again.");
        payNowBtn.disabled = false;
        payNowBtn.textContent = "Proceed to Payment";
      }
    });
  }

  // 4) Track Order button
  const trackBtn = document.getElementById("btnTrackOrder");
  if (trackBtn) {
    trackBtn.addEventListener("click", () => {
      window.location.href = "my_orders.html";
    });
  }
});
