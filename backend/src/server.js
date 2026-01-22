import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";

import { connectDB } from "./config/db.js";
import Address from "./models/Address.js";
import Order from "./models/Order.js";
import { userFromHeaders, requireAdmin } from "./middleware_auth.js";

// ✅ Razorpay payment routes
import paymentRoutes from "./routes/paymentRoutes.js";

dotenv.config();

// DB connect
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// ================= RAZORPAY PAYMENT =================
app.use("/api/payment", paymentRoutes);

// ================= ADDRESSES =================
app.get("/api/addresses", userFromHeaders, async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Not logged in" });

    const addresses = await Address.find({ userId: req.user.id }).sort({
      isDefault: -1,
      createdAt: 1,
    });

    res.json(addresses);
  } catch (err) {
    console.error("GET /api/addresses error:", err);
    res.status(500).json({ message: "Failed to load addresses" });
  }
});

app.get("/api/addresses/mine", userFromHeaders, async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Not logged in" });

    const addresses = await Address.find({ userId: req.user.id }).sort({
      isDefault: -1,
      createdAt: 1,
    });

    res.json(addresses);
  } catch (err) {
    console.error("GET /api/addresses/mine error:", err);
    res.status(500).json({ message: "Failed to load addresses" });
  }
});

app.post("/api/addresses", userFromHeaders, async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Not logged in" });

    const payload = req.body.address || req.body;
    if (!payload?.name || !payload?.mobile || !payload?.pin) {
      return res.status(400).json({ message: "Invalid address data" });
    }

    const isDefault = Boolean(req.body.isDefault);

    if (isDefault) {
      await Address.updateMany(
        { userId: req.user.id },
        { $set: { isDefault: false } }
      );
    }

    const id = payload._id || payload.id;
    if (id) {
      delete payload._id;
      delete payload.id;

      const updated = await Address.findOneAndUpdate(
        { _id: id, userId: req.user.id },
        { ...payload, isDefault, userEmail: req.user.email || "" },
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({ message: "Address not found" });
      }

      return res.json(updated);
    }

    const addr = await Address.create({
      userId: req.user.id,
      userEmail: req.user.email || "",
      ...payload,
      isDefault,
    });

    res.status(201).json(addr);
  } catch (err) {
    console.error("POST /api/addresses error:", err);
    res.status(500).json({ message: "Failed to add address" });
  }
});

app.delete("/api/addresses/:id", userFromHeaders, async (req, res) => {
  try {
    const deleted = await Address.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Address not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/addresses/:id error:", err);
    res.status(500).json({ message: "Failed to delete address" });
  }
});

// ================= CART =================
const cartItemSchema = new mongoose.Schema({
  productId: String,
  name: String,
  price: Number,
  quantity: Number,
  image: String,
});

const cartSchema = new mongoose.Schema(
  {
    userId: String,
    userEmail: String,
    items: [cartItemSchema],
  },
  { timestamps: true }
);

const Cart = mongoose.model("Cart", cartSchema);

app.post("/api/cart", userFromHeaders, async (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items))
    return res.status(400).json({ message: "items array required" });

  const doc = await Cart.findOneAndUpdate(
    { userId: req.user.id },
    { userId: req.user.id, userEmail: req.user.email, items },
    { upsert: true, new: true }
  );

  res.json(doc);
});

app.get("/api/cart", userFromHeaders, async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user.id });
  res.json(cart || { userId: req.user.id, items: [] });
});

// ================= ORDERS =================
app.post("/api/orders", userFromHeaders, async (req, res) => {
  try {
    const {
      items,
      amount,
      address,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = req.body;

    const orderDoc = await Order.create({
      userId: req.user.id,
      userEmail: req.user.email,
      items,
      amount,
      paymentStatus: "paid",
      paymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      razorpaySignature: razorpay_signature,
      address,
      status: "Processing",
    });

    res.json(orderDoc);
  } catch (err) {
    console.error("POST /api/orders error:", err);
    res.status(500).json({ message: "Failed to place order" });
  }
});

app.get("/api/orders/mine", userFromHeaders, async (req, res) => {
  const orders = await Order.find({ userId: req.user.id }).sort({
    createdAt: -1,
  });
  res.json(orders);
});

// ================= HEALTH =================
app.get("/", (req, res) => {
  res.json({ ok: true, message: "GT Mall backend running ✅" });
});

// ================= START SERVER =================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`GT Mall backend running on port ${PORT}`);
});

export default app;
