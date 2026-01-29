// public/js/checkout.js


// When Cashfree redirects back with cf_order_id in URL, confirm payment on backend
async function handleCashfreeReturn(cfOrderId) {
  try {
    if (!cfOrderId) return;

    // avoid duplicate confirmations on refresh
    const last = localStorage.getItem("lastConfirmedCfOrderId");
    if (last && last === String(cfOrderId)) {
      return;
    }

    let items = [];
    let address = null;

    try {
      const pendingCartRaw =
        localStorage.getItem("pendingOrderCart") ||
        localStorage.getItem("cartItems") ||
        "[]";
      items = JSON.parse(pendingCartRaw || "[]");
      if (!Array.isArray(items)) items = [];
    } catch {
      items = [];
    }

    try {
      const addrRaw = localStorage.getItem("pendingOrderAddress") || "null";
      address = JSON.parse(addrRaw);
    } catch {
      address = null;
    }

    if (!items.length) {
      console.warn("handleCashfreeReturn: no pending items found, skipping confirm");
      return;
    }

    const amount = items.reduce((sum, it) => {
      const price = Number(it.price || 0);
      const qty = Number(it.quantity || 1) || 1;
      return sum + price * qty;
    }, 0);

    const res = await fetch(API_BASE + "/api/cashfree/confirm", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        cfOrderId: cfOrderId,
        items,
        amount,
        address,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("Cashfree confirm failed:", res.status, txt);
      return;
    }

    const data = await res.json();
    if (!data || !data.success || !data.order) {
      console.error("Cashfree confirm response missing order:", data);
      return;
    }

    // mark as confirmed so repeated refresh does not duplicate orders
    localStorage.setItem("lastConfirmedCfOrderId", String(cfOrderId));

    // clear local cart + pending data
    localStorage.removeItem("pendingOrderCart");
    localStorage.removeItem("pendingOrderAddress");
    localStorage.removeItem("cartItems");
    localStorage.removeItem("buyNowItem");

    // Try to show success modal with order id
    const orderIdSpan = document.getElementById("successOrderId");
    if (orderIdSpan) {
      orderIdSpan.textContent =
        data.order._id ||
        data.order.paymentId ||
        data.order.razorpayOrderId ||
        String(cfOrderId);
    }

    const modalEl = document.getElementById("orderSuccessModal");
    if (modalEl && typeof bootstrap !== "undefined" && bootstrap.Modal) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    } else {
      alert(
        "Order placed successfully. Order ID: " +
          (data.order._id || String(cfOrderId))
      );
    }
  } catch (err) {
    console.error("handleCashfreeReturn error:", err);
  }
}

// NOTE: API_BASE & authHeaders ab global api.js se aayenge.
// Yaha sirf helper rakhe hain jo saved address ko checkout form me pre-fill karega.

async function prefillAddressFromSaved() {
  // agar login nahi hai to skip
  if (!localStorage.getItem("userUid")) return;

  try {
    const res = await fetch(API_BASE + "/api/addresses/mine", {
      headers: authHeaders(),
    });

    if (!res.ok) return;

    const list = await res.json();
    if (!Array.isArray(list) || list.length === 0) return;

    // Pehle default address, warna first
    const addr = list.find(a => a.isDefault) || list[0];
    if (!addr) return;

    const byId = (id) => document.getElementById(id);
    const setVal = (id, val) => {
      const el = byId(id);
      if (el && typeof val === "string") el.value = val;
    };

    setVal("addrName", addr.name || "");
    setVal("addrMobile", addr.mobile || addr.phone || "");
    setVal("addrAltMobile", addr.altMobile || "");
    setVal("addrEmail", addr.email || addr.userEmail || "");
    setVal("addrPincode", addr.pin || addr.pincode || "");
    setVal("addrLocality", addr.locality || "");
    setVal("addrAreaStreet", addr.areaStreet || addr.addressLine1 || "");
    setVal("addrCity", addr.city || "");
    setVal("addrState", addr.state || "");
    setVal("addrLandmark", addr.landmark || "");

    const type = (addr.type || "Home").toLowerCase();
    const homeRadio = byId("addrTypeHome");
    const workRadio = byId("addrTypeWork");
    if (homeRadio && workRadio) {
      if (type === "work") {
        workRadio.checked = true;
      } else {
        homeRadio.checked = true;
      }
    }
  } catch (e) {
    console.error("Failed to prefill address from saved:", e);
  }
}


document.addEventListener("DOMContentLoaded", () => {
  // Saved default address ko form me auto-fill karo
  prefillAddressFromSaved();

  const itemsList   = document.getElementById("checkoutItemsList");
  const subtotalEl  = document.getElementById("checkoutSubtotal");
  const totalEl     = document.getElementById("checkoutTotal");
  const payNowBtn   = document.getElementById("btnPayNow");


  // 1) Decide source of items: Buy Now (single product) OR full cart
  const urlParams = new URLSearchParams(window.location.search);
  const checkoutMode = urlParams.get("mode"); // "buynow" | null
  const cfOrderParam = urlParams.get("cf_order_id") || urlParams.get("order_id");

  // If returned from Cashfree payment, confirm on backend and show success
  if (cfOrderParam) {
    handleCashfreeReturn(cfOrderParam);
  }

  let cart = [];

  // Prefer Buy Now item if mode=buynow and stored
  if (checkoutMode === "buynow") {
    try {
      const buyNowRaw = localStorage.getItem("buyNowItem");
      if (buyNowRaw) {
        const buyNowItem = JSON.parse(buyNowRaw);
        if (buyNowItem && buyNowItem.id) {
          cart = [buyNowItem];
        }
      }
    } catch (e) {
      console.error("Failed to parse buyNowItem:", e);
    }
  }

  // Fallback to normal cart
  if (!cart.length) {
    try {
      cart = JSON.parse(localStorage.getItem("cartItems") || "[]");
    } catch (err) {
      console.error("Cart parse error:", err);
      cart = [];
    }
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


  // 3) Handle Pay Now click (Cashfree Standard Checkout)
  if (payNowBtn) {
    payNowBtn.addEventListener("click", async () => {
      // ---- ADDRESS READ + VALIDATION ----
      const name       = document.getElementById("addrName")?.value.trim();
      const mobile     = document.getElementById("addrMobile")?.value.trim();
      const email      = document.getElementById("addrEmail")?.value.trim();
      const pin        = document.getElementById("addrPincode")?.value.trim();
      const locality   = document.getElementById("addrLocality")?.value.trim();
      const areaStreet = document.getElementById("addrAreaStreet")?.value.trim();
      const city       = document.getElementById("addrCity")?.value.trim();
      const state      = document.getElementById("addrState")?.value.trim();
      const landmark   = document.getElementById("addrLandmark")?.value.trim();
      const altMobile  = document.getElementById("addrAltMobile")?.value.trim();
      const addrType   =
        document.querySelector("input[name='addrType']:checked")?.value ||
        "Home";

      // Basic validation
      if (
        !name ||
        !mobile ||
        mobile.length !== 10 ||
        !pin ||
        pin.length < 4 ||
        !locality ||
        !areaStreet ||
        !city ||
        !state ||
        !email
      ) {
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
        addrType,
      };

      if (!cart.length) {
        alert("Your cart is empty.");
        return;
      }

      try {
        payNowBtn.disabled = true;
        payNowBtn.textContent = "Processing...";

        // 3a) Save address in backend (for My Addresses)
        try {
          await fetch(API_BASE + "/api/addresses", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
              address,
              isDefault: true,
            }),
          });
        } catch (addrErr) {
          console.error("Failed to save address in DB:", addrErr);
          // continue payment flow anyway
        }

        // 3b) Ask backend to create Cashfree order
        const createRes = await fetch(API_BASE + "/api/cashfree/create-order", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            amount: subtotal,
            customerPhone: mobile,
          }),
        });

        const cfOrder = await createRes.json();
        if (!createRes.ok || !cfOrder.paymentSessionId) {
          console.error("Cashfree order response:", cfOrder);
          alert("Unable to create payment order. Please try again.");
          payNowBtn.disabled = false;
          payNowBtn.textContent = "Proceed to Payment";
          return;
        }

        // Store pending cart + address so we can create local order after redirect
        localStorage.setItem("pendingOrderCart", JSON.stringify(cart));
        localStorage.setItem("pendingOrderAddress", JSON.stringify(address));

        // 3c) Open Cashfree checkout (redirect mode)
        if (typeof Cashfree !== "function") {
          alert("Payment SDK not loaded. Please refresh the page.");
          payNowBtn.disabled = false;
          payNowBtn.textContent = "Proceed to Payment";
          return;
        }

        const cashfree = Cashfree({ mode: "sandbox" }); // test mode
        cashfree.checkout({
          paymentSessionId: cfOrder.paymentSessionId,
          redirectTarget: "_self", // redirect to Cashfree hosted page
        });
      } catch (err) {
        console.error("Cashfree payment init error:", err);
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
