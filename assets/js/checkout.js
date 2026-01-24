// public/js/checkout.js
// NOTE: API_BASE & authHeaders api.js se aate hain

// ----------------------------
// Prefill address from saved
// ----------------------------
async function prefillAddressFromSaved() {
  if (!localStorage.getItem("userUid")) return;

  try {
    const res = await fetch(API_BASE + "/api/addresses/mine", {
      headers: authHeaders(),
    });
    if (!res.ok) return;

    const list = await res.json();
    if (!Array.isArray(list) || !list.length) return;

    const addr = list.find(a => a.isDefault) || list[0];
    if (!addr) return;

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el && typeof val === "string") el.value = val;
    };

    set("addrName", addr.name || "");
    set("addrMobile", addr.mobile || "");
    set("addrAltMobile", addr.altMobile || "");
    set("addrEmail", addr.email || addr.userEmail || "");
    set("addrPincode", addr.pin || "");
    set("addrLocality", addr.locality || "");
    set("addrAreaStreet", addr.areaStreet || "");
    set("addrCity", addr.city || "");
    set("addrState", addr.state || "");
    set("addrLandmark", addr.landmark || "");

    const type = (addr.type || "Home").toLowerCase();
    document.getElementById(type === "work" ? "addrTypeWork" : "addrTypeHome")?.click();
  } catch (e) {
    console.error("Prefill address failed:", e);
  }
}

// ----------------------------
// Main
// ----------------------------
document.addEventListener("DOMContentLoaded", () => {
  prefillAddressFromSaved();

  const itemsList  = document.getElementById("checkoutItemsList");
  const subtotalEl = document.getElementById("checkoutSubtotal");
  const totalEl    = document.getElementById("checkoutTotal");
  const payNowBtn  = document.getElementById("btnPayNow");

  // ----------------------------
  // Load cart / buy-now
  // ----------------------------
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode"); // buynow | null

  let cart = [];

  if (mode === "buynow") {
    try {
      const raw = localStorage.getItem("buyNowItem");
      if (raw) {
        const item = JSON.parse(raw);
        if (item && item.id) cart = [item];
      }
    } catch {}
  }

  if (!cart.length) {
    try {
      cart = JSON.parse(localStorage.getItem("cartItems") || "[]");
    } catch {
      cart = [];
    }
  }

  if (!cart.length) {
    itemsList.innerHTML = `<li class="list-group-item">Your cart is empty.</li>`;
    subtotalEl.textContent = "₹0";
    totalEl.textContent = "₹0";
    payNowBtn.disabled = true;
    payNowBtn.textContent = "Cart is empty";
    return;
  }

  // ----------------------------
  // Render cart
  // ----------------------------
  let subtotal = 0;
  itemsList.innerHTML = "";

  cart.forEach(item => {
    const line = (item.price || 0) * (item.quantity || 1);
    subtotal += line;

    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between";
    li.innerHTML = `<div>${item.name || "Product"}</div><strong>₹${line}</strong>`;
    itemsList.appendChild(li);
  });

  subtotalEl.textContent = "₹" + subtotal;
  totalEl.textContent = "₹" + subtotal;

  // ----------------------------
  // Pay Now
  // ----------------------------
  payNowBtn.addEventListener("click", async () => {
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
      document.querySelector("input[name='addrType']:checked")?.value || "Home";

    if (
      !name || !mobile || mobile.length !== 10 ||
      !email || !pin || !locality || !areaStreet || !city || !state
    ) {
      alert("Please fill all required address fields correctly.");
      return;
    }

    const address = {
      name, mobile, altMobile, email, pin,
      locality, areaStreet, city, state, landmark, addrType,
    };

    try {
      payNowBtn.disabled = true;
      payNowBtn.textContent = "Processing...";

      // Save address (safe, optional)
      fetch(API_BASE + "/api/addresses", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ address, isDefault: true }),
      }).catch(() => {});

      // Create Razorpay order
      const res = await fetch(API_BASE + "/api/razorpay/create-order", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ amount: subtotal }),
      });

      const data = await res.json();
      if (!res.ok || !data.orderId) {
        alert("Unable to start payment.");
        payNowBtn.disabled = false;
        payNowBtn.textContent = "Proceed to Payment";
        return;
      }

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: "INR",
        order_id: data.orderId,
        name: "GT Mall",
        handler: function () {
          alert("Payment successful. Order will appear shortly.");
          localStorage.removeItem("cartItems");
          localStorage.removeItem("buyNowItem");
          window.location.href = "my_orders.html";
        },
      };

      new Razorpay(options).open();
    } catch (err) {
      console.error(err);
      alert("Payment failed. Please try again.");
      payNowBtn.disabled = false;
      payNowBtn.textContent = "Proceed to Payment";
    }
  });
});
