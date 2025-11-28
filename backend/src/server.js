import express from "express";
import cors from "cors";
import Razorpay from "razorpay";
import dotenv from "dotenv";
dotenv.config();

// ---------------------------
//  DATABASE & MODELS
// ---------------------------
import { connectDB } from "./config/db.js";
import User from "./models/User.js";
import Address from "./models/Address.js";
import Order from "./models/Order.js";

// ⚠ IMPORTANT: file name EXACTLY products.js
import Product from "./models/product.js";

// ---------------------------
//  AUTH MIDDLEWARE
// ---------------------------
import { userFromHeaders, requireAdmin } from "./middleware_auth.js";

connectDB();

const app = express();
app.use(express.json());
app.use(cors());

// ---------------------------
//  BASE HEALTH CHECK
// ---------------------------
app.get("/", (req, res) => {
  res.json({ message: "Backend running ✔" });
});

// ---------------------------
//  ADDRESS APIs (already working)
// ---------------------------
app.post("/api/address", userFromHeaders, async (req, res) => {
  try {
    const user = req.user;

    const address = await Address.create({
      userId: user.id,
      ...req.body,
    });

    res.json(address);
  } catch (err) {
    console.log("Address error:", err);
    res.status(500).json({ message: "Failed to add address" });
  }
});

app.get("/api/address", userFromHeaders, async (req, res) => {
  const addresses = await Address.find({ userId: req.user.id });
  res.json(addresses);
});

// ---------------------------
//   PLACE ORDER API
// ---------------------------
app.post("/api/orders", userFromHeaders, async (req, res) => {
  try {
    const { items, amount, address, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

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
    console.log("Order error:", err);
    res.status(500).json({ message: "Failed to place order" });
  }
});

// ---------------------------
//   ADMIN: GET ALL ORDERS
// ---------------------------
app.get("/api/admin/orders", userFromHeaders, requireAdmin, async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.log("Admin orders error:", err);
    res.status(500).json({ message: "Failed to load orders" });
  }
});

// =====================================
//   SELLER PANEL – PRODUCT MANAGEMENT
// =====================================

// Get all products
app.get("/api/admin/products", userFromHeaders, requireAdmin, async (req, res) => {
  try {
    const products = await Product.find({}).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.log("Get products error:", err);
    res.status(500).json({ message: "Failed to load products" });
  }
});

// Create new product
app.post("/api/admin/products", userFromHeaders, requireAdmin, async (req, res) => {
  try {
    const body = req.body;

    const product = await Product.create({
      name: body.name || body.title,
      title: body.title || body.name,
      description: body.description || "",
      price: Number(body.price) || 0,
      mrp: Number(body.mrp || body.price || 0),
      category: body.category || "",
      image: body.image || "",
      images: body.images?.length ? body.images : body.image ? [body.image] : [],
      stock: Number(body.stock || 0),
      isActive: true,
    });

    res.status(201).json(product);
  } catch (err) {
    console.log("Create product error:", err);
    res.status(500).json({ message: "Failed to create product" });
  }
});

// Update product
app.put("/api/admin/products/:id", userFromHeaders, requireAdmin, async (req, res) => {
  try {
    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!updated) return res.status(404).json({ message: "Product not found" });

    res.json(updated);
  } catch (err) {
    console.log("Update product error:", err);
    res.status(500).json({ message: "Failed to update product" });
  }
});

// Delete product
app.delete("/api/admin/products/:id", userFromHeaders, requireAdmin, async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Product not found" });

    res.json({ message: "Deleted" });
  } catch (err) {
    console.log("Delete product error:", err);
    res.status(500).json({ message: "Failed to delete product" });
  }
});

// Bulk CSV upload
app.post("/api/admin/products/bulk", userFromHeaders, requireAdmin, async (req, res) => {
  try {
    const rows = req.body.rows || [];
    if (!rows.length) return res.status(400).json({ message: "No rows found" });

    const docs = rows.map((r) => ({
      name: r.name,
      title: r.name,
      description: r.description || "",
      price: Number(r.price || 0),
      mrp: Number(r.mrp || r.price || 0),
      category: r.category || "",
      image: r.image,
      images: r.image ? [r.image] : [],
      stock: Number(r.stock || 0),
      isActive: true,
    }));

    await Product.insertMany(docs);
    res.json({ inserted: docs.length });
  } catch (err) {
    console.log("Bulk upload error:", err);
    res.status(500).json({ message: "Failed bulk upload" });
  }
});

// ---------------------------
//   START SERVER
// ---------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));

export default app;




