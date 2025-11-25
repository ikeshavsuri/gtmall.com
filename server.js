require("dotenv").config();
const express = require("express");
const path = require("path");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Razorpay init
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create order
app.post("/api/create-order", async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount) {
      return res.status(400).json({ error: "Amount is required" });
    }

    const options = {
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: "gtm_" + Date.now()
    };

    const order = await razorpay.orders.create(options);
    res.json(order);

  } catch (error) {
    console.error("Order Create Error:", error);
    res.status(500).json({ error: "Order creation failed" });
  }
});

// Verify payment
app.post("/api/verify-payment", (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      address,
      cartItems
    } = req.body;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (expectedSign === razorpay_signature) {
      console.log("Payment Verified → ORDER:", razorpay_order_id);

      return res.json({
        success: true,
        orderId: razorpay_order_id
      });
    }

    res.json({ success: false });

  } catch (error) {
    console.error("Verify Error:", error);
    res.status(500).json({ error: "Verification error" });
  }
});

// Handle page reload issues on hosting
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Server Listen
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`GT Mall running on port ${PORT}`));
