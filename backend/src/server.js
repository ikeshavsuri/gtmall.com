import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import fetch from "node-fetch";
import dotenv from "dotenv";
import Razorpay from "razorpay";
import crypto from "crypto";

import { connectDB } from "./config/db.js";
import Address from "./models/Address.js";
import Order from "./models/Order.js";
import { userFromHeaders, requireAdmin } from "./middleware_auth.js";

dotenv.config();

// --------------------
// RAZORPAY INSTANCE
// --------------------
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// --------------------
// DB CONNECT
// --------------------
connectDB();

const app = express();

/**
 * ⚠️ IMPORTANT:
 * Razorpay webhook ke liye raw body chahiye.
 * Isliye webhook route se PEHLE express.json() use nahi karte.
 */
app.use(cors());
app.use(express.json());

// ===================================================
// ADDRESS APIs
// ===================================================

// GET all addresses
app.get("/api/addresses", userFromHeaders, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Not logged in" });
    }

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

// BACKWARD COMPAT
app.get("/api/addresses/mine", userFromHeaders, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Not logged in" });
    }

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

// CREATE / UPDATE address
app.post("/api/addresses", userFromHeaders, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const body = req.body || {};
    const payload = body.address || body;

    if (!payload?.name || !payload?.mobile || !payload?.pin) {
      return res.status(400).json({ message: "Invalid address data" });
    }

    const isDefault = Boolean(body.isDefault);

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

// DELETE address
app.delete("/api/addresses/:id", userFromHeaders, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const deleted = await Address.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Address not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/addresses error:", err);
    res.status(500).json({ message: "Failed to delete address" });
  }
});

// ===================================================
// RAZORPAY CREATE ORDER
// ===================================================
app.post("/api/razorpay/create-order", userFromHeaders, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: "rcpt_" + Date.now(),
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Razorpay create order error:", err);
    res.status(500).json({ message: "Unable to start payment" });
  }
});

// ===================================================
// RAZORPAY CONFIRM (MAIN ORDER CREATE)
// ===================================================
app.post("/api/razorpay/confirm", userFromHeaders, async (req, res) => {
  try {
    const { razorpayPaymentId, items, amount, address } = req.body;

    if (!razorpayPaymentId || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ success: false });
    }

    const existing = await Order.findOne({ paymentId: razorpayPaymentId });
    if (existing) {
      return res.json({ success: true, order: existing });
    }

    const order = await Order.create({
      userId: req.user.id,
      userEmail: req.user.email,
      items,
      amount,
      address,
      paymentStatus: "paid",
      paymentId: razorpayPaymentId,
      status: "Processing",
      refundStatus: "none",
    });

    res.json({ success: true, order });
  } catch (err) {
    console.error("Payment confirm error:", err);
    res.status(500).json({ success: false });
  }
});

// ===================================================
// RAZORPAY WEBHOOK
// ===================================================
app.post(
  "/api/razorpay/webhook",
  express.raw({ type: "*/*" }),
  async (req, res) => {
    try {
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
      const signature = req.headers["x-razorpay-signature"];

      const expected = crypto
        .createHmac("sha256", secret)
        .update(req.body)
        .digest("hex");

      if (signature !== expected) {
        return res.status(400).send("Invalid signature");
      }

      const event = JSON.parse(req.body.toString());

      if (event.event === "payment.captured") {
        const paymentId = event.payload.payment.entity.id;
        await Order.findOneAndUpdate(
          { paymentId },
          { paymentStatus: "paid" }
        );
      }

      res.json({ ok: true });
    } catch (err) {
      console.error("Webhook error:", err);
      res.status(500).json({ ok: false });
    }
  }
);

// ===================================================
// ADMIN REFUND API
// ===================================================
app.post(
  "/api/admin/refund/:orderId",
  userFromHeaders,
  requireAdmin,
  async (req, res) => {
    try {
      const order = await Order.findById(req.params.orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      order.refundStatus = "processed";
      order.paymentStatus = "refunded";
      order.refundId = "RF_" + Date.now();

      await order.save();
      res.json({ success: true, order });
    } catch (err) {
      console.error("Refund error:", err);
      res.status(500).json({ success: false });
    }
  }
);


// ---------------------------
//  CART MODEL (cross-device sync)
// ---------------------------
const cartItemSchema = new mongoose.Schema({
  productId: { type: String, default: "" },
  name: { type: String, default: "" },
  price: { type: Number, default: 0 },
  quantity: { type: Number, default: 1 },
  image: { type: String, default: "" },
});

const cartSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, required: true },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true }
);

const Cart = mongoose.model("Cart", cartSchema);

// ---------------------------
//  PRODUCT MODEL (seller/admin panel)
// ---------------------------
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    title: { type: String, default: "" },
    description: { type: String, default: "" },

    price: { type: Number, required: true },
    mrp: { type: Number, default: 0 },
    category: { type: String, default: "" },

    // main image
    image: { type: String, default: "" },

    // extra images
    images: { type: [String], default: [] },

    stock: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);

// ===================================================
// CART APIs
// ===================================================

// SAVE / REPLACE CART
app.post("/api/cart", userFromHeaders, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const { items } = req.body || {};
    if (!Array.isArray(items)) {
      return res.status(400).json({ message: "items array required" });
    }

    const cart = await Cart.findOneAndUpdate(
      { userId: req.user.id },
      {
        userId: req.user.id,
        userEmail: req.user.email || "",
        items,
      },
      { upsert: true, new: true }
    );

    res.json(cart);
  } catch (err) {
    console.error("POST /api/cart error:", err);
    res.status(500).json({ message: "Failed to save cart" });
  }
});

// GET FULL CART OBJECT
app.get("/api/cart", userFromHeaders, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const cart = await Cart.findOne({ userId: req.user.id });
    res.json(cart || { userId: req.user.id, items: [] });
  } catch (err) {
    console.error("GET /api/cart error:", err);
    res.status(500).json({ message: "Failed to load cart" });
  }
});

// ---------------------------
// BACKWARD-COMPAT ROUTES
// (older frontend support)
// ---------------------------

// SAVE CART (legacy)
app.post("/api/cart/mine", userFromHeaders, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const { items } = req.body || {};
    if (!Array.isArray(items)) {
      return res.status(400).json({ message: "items array required" });
    }

    const cart = await Cart.findOneAndUpdate(
      { userId: req.user.id },
      {
        userId: req.user.id,
        userEmail: req.user.email || "",
        items,
      },
      { upsert: true, new: true }
    );

    res.json(cart);
  } catch (err) {
    console.error("POST /api/cart/mine error:", err);
    res.status(500).json({ message: "Failed to save cart" });
  }
});

// GET CART ITEMS ONLY (legacy)
app.get("/api/cart/mine", userFromHeaders, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const cart = await Cart.findOne({ userId: req.user.id });
    res.json(cart?.items || []);
  } catch (err) {
    console.error("GET /api/cart/mine error:", err);
    res.status(500).json({ message: "Failed to load cart" });
  }
});

// ---------------------
// ADDRESS APIs
// ---------------------
app.post("/api/address", userFromHeaders, async (req, res) => {
  try {
    const body = req.body || {};

    if (!body.name || !body.mobile || !body.pin) {
      return res.status(400).json({ message: "Invalid address data" });
    }

    const address = await Address.create({
      userId: req.user.id,
      userEmail: req.user.email || "",
      ...body,
    });

    res.status(201).json(address);
  } catch (err) {
    console.error("POST /api/address error:", err);
    res.status(500).json({ message: "Failed to add address" });
  }
});

app.get("/api/address", userFromHeaders, async (req, res) => {
  try {
    const addresses = await Address.find({ userId: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(addresses);
  } catch (err) {
    console.error("GET /api/address error:", err);
    res.status(500).json({ message: "Failed to load addresses" });
  }
});

// ---------------------------
//  ORDERS (USER SIDE)
// ---------------------------

// My Orders
app.get("/api/orders/mine", userFromHeaders, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const orders = await Order.find({ userId: req.user.id }).sort({
      createdAt: -1,
    });

    res.json(orders);
  } catch (err) {
    console.error("GET /api/orders/mine error:", err);
    res.status(500).json({ message: "Failed to load orders" });
  }
});

// Alias (old frontend support)
app.get("/api/my-orders", userFromHeaders, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(orders);
  } catch (err) {
    console.error("GET /api/my-orders error:", err);
    res.status(500).json({ message: "Failed to load orders" });
  }
});

// USER → REQUEST REFUND
app.post(
  "/api/orders/:id/request-refund",
  userFromHeaders,
  async (req, res) => {
    try {
      const order = await Order.findOne({
        _id: req.params.id,
        userId: req.user.id,
      });

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (order.paymentStatus !== "paid") {
        return res.status(400).json({ message: "Order not paid" });
      }

      if (order.refundStatus === "requested") {
        return res.status(400).json({ message: "Refund already requested" });
      }

      order.refundStatus = "requested";
      order.returnRequested = true;
      await order.save();

      res.json({ success: true });
    } catch (err) {
      console.error("request refund error:", err);
      res.status(500).json({ message: "Failed to request refund" });
    }
  }
);

// ---------------------------
//  ADMIN: ORDERS
// ---------------------------
app.get(
  "/api/admin/orders",
  userFromHeaders,
  requireAdmin,
  async (req, res) => {
    try {
      const orders = await Order.find({}).sort({ createdAt: -1 });
      res.json(orders);
    } catch (err) {
      console.error("GET /api/admin/orders error:", err);
      res.status(500).json({ message: "Failed to load admin orders" });
    }
  }
);

// ADMIN → APPROVE & PROCESS REFUND
app.post(
  "/api/admin/orders/:id/refund",
  userFromHeaders,
  requireAdmin,
  async (req, res) => {
    try {
      const order = await Order.findById(req.params.id);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (order.paymentStatus !== "paid") {
        return res.status(400).json({ message: "Order not paid" });
      }

      if (order.refundStatus === "processed") {
        return res
          .status(400)
          .json({ message: "Refund already processed" });
      }

      if (!order.paymentId) {
        return res
          .status(400)
          .json({ message: "Missing Razorpay paymentId" });
      }

      // 🔥 Razorpay refund
      const refund = await razorpay.payments.refund(order.paymentId, {
        amount: Math.round(order.amount * 100),
      });

      order.paymentStatus = "refunded";
      order.refundStatus = "processed";
      order.refundId = refund.id;
      order.status = "Cancelled";

      await order.save();

      res.json({
        success: true,
        refundId: refund.id,
      });
    } catch (err) {
      console.error("admin refund error:", err);
      res.status(500).json({ message: "Refund failed" });
    }
  }
);

// ADMIN → UPDATE ORDER STATUS
app.put(
  "/api/admin/orders/:id/status",
  userFromHeaders,
  requireAdmin,
  async (req, res) => {
    try {
      const { status } = req.body || {};
      const allowed = ["Processing", "Shipped", "Delivered", "Cancelled"];

      if (!allowed.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const updated = await Order.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({ message: "Order not found" });
      }

      res.json(updated);
    } catch (err) {
      console.error("PUT /api/admin/orders/:id/status error:", err);
      res.status(500).json({ message: "Failed to update status" });
    }
  }
);

// ---------------------------
//  PRODUCTS (PUBLIC + ADMIN)
// ---------------------------

// PUBLIC: list products
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find({
      $or: [{ isActive: true }, { isActive: { $exists: false } }],
    }).sort({ createdAt: -1 });

    res.json(products);
  } catch (err) {
    console.error("GET /api/products error:", err);
    res.status(500).json({ message: "Failed to load products" });
  }
});

// PUBLIC: product by id
app.get("/api/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || product.isActive === false) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  } catch (err) {
    console.error("GET /api/products/:id error:", err);
    res.status(500).json({ message: "Failed to load product" });
  }
});

// PUBLIC: similar products
app.get("/api/products/:id/similar", async (req, res) => {
  try {
    const current = await Product.findById(req.params.id);
    if (!current) return res.json([]);

    const similar = await Product.find({
      _id: { $ne: current._id },
      category: current.category,
      $or: [{ isActive: true }, { isActive: { $exists: false } }],
    })
      .sort({ createdAt: -1 })
      .limit(8);

    res.json(similar);
  } catch (err) {
    console.error("GET /api/products/:id/similar error:", err);
    res.status(500).json({ message: "Failed to load similar products" });
  }
});
