// backend/src/server.js

import dotenv from "dotenv";
dotenv.config();
import Product from "./assets/js/Product.js";



import express from "express";
import cors from "cors";
import Razorpay from "razorpay";
import crypto from "crypto";
import mongoose from "mongoose";

import { connectDB } from "./config/db.js";
import Address from "./models/Address.js";
import Order from "./models/Order.js";
import { userFromHeaders, requireAdmin } from "./middleware_auth.js";

// -------------------- BASIC APP SETUP --------------------

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB connect
connectDB();

// -------------------- RAZORPAY SETUP --------------------

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// -------------------- CART MODEL (for cross-device cart sync) --------------------

const cartItemSchema = new mongoose.Schema({
  productId: String,
  name: String,
  price: Number,
  quantity: Number,
  image: String,
});

const cartSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    userEmail: { type: String, required: true },
    items: [cartItemSchema],
  },
  { timestamps: true }
);

const Cart = mongoose.model("Cart", cartSchema);

// -------------------- HELPERS --------------------

function currentUser(req) {
  // middleware_auth userFromHeaders will set req.user
  if (!req.user) return null;
  return {
    id: req.user.firebaseUid,
    email: req.user.email,
    name: req.user.name || "User",
  };
}

// Simple health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// -------------------- ADDRESS APIs --------------------

// GET  /api/addresses/mine  -> current user addresses
app.get("/api/addresses/mine", userFromHeaders, async (req, res) => {
  try {
    const user = currentUser(req);
    if (!user?.email) {
      return res.status(401).json({ message: "Auth required" });
    }

    const addresses = await Address.find({ userEmail: user.email }).sort({
      isDefault: -1,
      createdAt: 1,
    });

    return res.json(addresses);
  } catch (err) {
    console.error("GET /api/addresses/mine error:", err);
    return res.status(500).json({ message: "Failed to load addresses" });
  }
});

// POST /api/addresses  -> create new address
app.post("/api/addresses", userFromHeaders, async (req, res) => {
  try {
    const user = currentUser(req);
    if (!user?.email || !user?.id) {
      return res.status(401).json({ message: "Auth required" });
    }

    const { address, isDefault } = req.body;

    if (
      !address ||
      !address.name ||
      !address.mobile ||
      !address.pin ||
      !address.locality ||
      !address.areaStreet ||
      !address.city ||
      !address.state ||
      !address.email
    ) {
      return res.status(400).json({ message: "Invalid address data" });
    }

    // clear old default if new one is default
    if (isDefault) {
      await Address.updateMany(
        { userEmail: user.email },
        { $set: { isDefault: false } }
      );
    }

    const doc = await Address.create({
      userId: user.id,
      userEmail: user.email,
      ...address,
      isDefault: !!isDefault,
    });

    return res.status(201).json({ success: true, address: doc });
  } catch (err) {
    console.error("POST /api/addresses error:", err);
    return res.status(500).json({ message: "Failed to save address" });
  }
});

// -------------------- CART APIs (cross-device sync) --------------------

// GET /api/cart/mine  -> current user cart items
app.get("/api/cart/mine", userFromHeaders, async (req, res) => {
  try {
    const user = currentUser(req);
    if (!user?.id || !user?.email) {
      return res.status(401).json({ message: "Auth required" });
    }

    let cart = await Cart.findOne({ userId: user.id });
    if (!cart) {
      cart = await Cart.create({
        userId: user.id,
        userEmail: user.email,
        items: [],
      });
    }

    return res.json(cart.items || []);
  } catch (err) {
    console.error("GET /api/cart/mine error:", err);
    return res.status(500).json({ message: "Failed to load cart" });
  }
});

// POST /api/cart/mine  -> overwrite user cart
app.post("/api/cart/mine", userFromHeaders, async (req, res) => {
  try {
    const user = currentUser(req);
    if (!user?.id || !user?.email) {
      return res.status(401).json({ message: "Auth required" });
    }

    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ message: "Items array required" });
    }

    const cart = await Cart.findOneAndUpdate(
      { userId: user.id },
      { userEmail: user.email, items },
      { new: true, upsert: true }
    );

    return res.json({ success: true, items: cart.items || [] });
  } catch (err) {
    console.error("POST /api/cart/mine error:", err);
    return res.status(500).json({ message: "Failed to save cart" });
  }
});
// ---------- SELLER / ADMIN PRODUCT ROUTES ----------

// List all products (for admin/seller)
app.get("/api/admin/products", userFromHeaders, requireAdmin, async (req, res) => {
  try {
    const products = await Product.find({}).sort({ createdAt: -1 });
    return res.json(products);
  } catch (err) {
    console.error("GET /api/admin/products error:", err);
    return res.status(500).json({ message: "Failed to load products" });
  }
});

// Create single product
app.post("/api/admin/products", userFromHeaders, requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};

    // Map from generic payload to your Product schema
    const data = {
      name: body.name || body.title,
      title: body.title || body.name,
      description: body.description || "",
      price: Number(body.price) || 0,
      mrp: Number(body.mrp || body.price || 0),
      category: body.category || "",
      image: body.image || "",
      images: body.images && body.images.length ? body.images : (body.image ? [body.image] : []),
      stock: body.stock ?? 0,
      isActive: body.isActive !== false,
    };

    const product = await Product.create(data);
    return res.status(201).json(product);
  } catch (err) {
    console.error("POST /api/admin/products error:", err);
    return res.status(500).json({ message: "Failed to create product" });
  }
});

// Update product
app.put("/api/admin/products/:id", userFromHeaders, requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const update = {
      name: body.name || body.title,
      title: body.title || body.name,
      description: body.description,
      price: body.price,
      mrp: body.mrp,
      category: body.category,
      image: body.image,
      images: body.images,
      stock: body.stock,
      isActive: body.isActive,
    };
    const product = await Product.findByIdAndUpdate(req.params.id, update, {
      new: true,
    });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    return res.json(product);
  } catch (err) {
    console.error("PUT /api/admin/products/:id error:", err);
    return res.status(500).json({ message: "Failed to update product" });
  }
});

// Delete product
app.delete("/api/admin/products/:id", userFromHeaders, requireAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    return res.json({ message: "Deleted" });
  } catch (err) {
    console.error("DELETE /api/admin/products/:id error:", err);
    return res.status(500).json({ message: "Failed to delete product" });
  }
});

// Bulk upload from CSV
app.post("/api/admin/products/bulk", userFromHeaders, requireAdmin, async (req, res) => {
  try {
    const rows = req.body?.rows || [];
    if (!rows.length) {
      return res.status(400).json({ message: "No rows provided" });
    }

    const docs = rows.map((row) => {
      const price = Number(row.price || 0);
      const mrp = Number(row.mrp || price || 0);
      const stock = Number(row.stock || 0);

      const image = row.image || "";
      const images = image ? [image] : [];

      return {
        name: row.name || row.title,
        title: row.title || row.name,
        description: row.description || "",
        price,
        mrp,
        category: row.category || "",
        image,
        images,
        stock,
        isActive: true,
      };
    });

    await Product.insertMany(docs);
    return res.json({ inserted: docs.length });
  } catch (err) {
    console.error("POST /api/admin/products/bulk error:", err);
    return res.status(500).json({ message: "Bulk upload failed" });
  }
});


// -------------------- ORDERS & PAYMENT --------------------

// GET /api/admin/orders  -> all orders for admin dashboard
app.get("/api/admin/orders", userFromHeaders, requireAdmin, async (req, res) => {
  try {
    // Admin can see all orders, newest first
    const orders = await Order.find({}).sort({ createdAt: -1 });
    return res.json(orders);
  } catch (err) {
    console.error("GET /api/admin/orders error:", err);
    return res.status(500).json({ message: "Failed to load admin orders" });
  }
});



// GET /api/orders/mine  -> current user orders
app.get("/api/orders/mine", userFromHeaders, async (req, res) => {
  try {
    const user = currentUser(req);
    if (!user?.id) {
      return res.status(401).json({ message: "Auth required" });
    }

    const orders = await Order.find({ userId: user.id }).sort({
      createdAt: -1,
    });

    return res.json(orders);
  } catch (err) {
    console.error("GET /api/orders/mine error:", err);
    return res.status(500).json({ message: "Failed to load orders" });
  }
});

// POST /api/create-order  -> create Razorpay order
app.post("/api/create-order", userFromHeaders, async (req, res) => {
  try {
    const user = currentUser(req);
    if (!user?.id) {
      return res.status(401).json({ message: "Auth required" });
    }

    let { amount } = req.body;
    if (!amount || isNaN(Number(amount))) {
      return res.status(400).json({ message: "Amount required" });
    }

    amount = Math.round(Number(amount) * 100); // to paise

    const options = {
      amount,
      currency: "INR",
      receipt: "gtm_" + Date.now(),
    };

    const order = await razorpay.orders.create(options);
    return res.json(order);
  } catch (error) {
    console.error("Order Create Error:", error);
    return res.status(500).json({ error: "Order creation failed" });
  }
});

// POST /api/verify-payment  -> verify Razorpay payment & create Order doc
app.post("/api/verify-payment", userFromHeaders, async (req, res) => {
  try {
    const user = currentUser(req);
    if (!user?.id) {
      return res.status(401).json({ message: "Auth required" });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      address,
      cartItems,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res
        .status(400)
        .json({ success: false, message: "Missing payment data" });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid signature" });
    }

    const items = Array.isArray(cartItems) ? cartItems : [];
    const amount = items.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (item.quantity || 1),
      0
    );

    const orderDoc = await Order.create({
      userId: user.id,
      userEmail: user.email,
      items: items.map((i) => ({
        productId: i.id?.toString() || "",
        name: i.name,
        price: i.price,
        quantity: i.quantity || 1,
        image: i.img || i.image || "",
      })),
      amount,
      paymentStatus: "paid",
      paymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      razorpaySignature: razorpay_signature,
      address,
      status: "Processing",
    });

    // clear cart after successful order
    await Cart.findOneAndUpdate({ userId: user.id }, { items: [] });

    return res.json({ success: true, orderId: orderDoc._id });
  } catch (error) {
    console.error("Verify Error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Verification error" });
  }
});

// -------------------- START SERVER --------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`GT Mall backend running on port ${PORT}`);
});
