import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import dotenv from "dotenv";

dotenv.config();

import { connectDB } from "./config/db.js";
// import { User } from "./models/User.js";  // agar kahin use nahi ho raha to comment rehne do
import Address from "./models/Address.js";
import Order from "./models/Order.js";

import { userFromHeaders, requireAdmin } from "./middleware_auth.js";

// DB connect
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------
//  RAZORPAY SETUP
// ---------------------------
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// (optional) frontend agar Razorpay order create route use kare:
app.post("/api/razorpay/create-order", userFromHeaders, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount) {
      return res.status(400).json({ message: "Amount is required" });
    }

    const options = {
      amount: Math.round(Number(amount) * 100), // in paise
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    return res.json(order);
  } catch (err) {
    console.error("Razorpay create order error:", err);
    return res.status(500).json({ message: "Failed to create payment order" });
  }
});

// ---------------------------
//  SIMPLE HEALTH CHECK
// ---------------------------
app.get("/", (req, res) => {
  res.json({ ok: true, message: "GT Mall backend running ✅" });
});

// ---------------------------
//  CART MODEL (cross-device sync)
// ---------------------------
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
// ------------- PRODUCT MODEL (for seller/admin panel) -------------
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    title: { type: String },
    description: { type: String, default: "" },
    price: { type: Number, required: true },
    mrp: { type: Number },
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


// save / replace cart
app.post("/api/cart", userFromHeaders, async (req, res) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items)) {
      return res.status(400).json({ message: "items array required" });
    }

    const doc = await Cart.findOneAndUpdate(
      { userId: req.user.id },
      { userId: req.user.id, userEmail: req.user.email, items },
      { upsert: true, new: true }
    );

    return res.json(doc);
  } catch (err) {
    console.error("POST /api/cart error:", err);
    return res.status(500).json({ message: "Failed to save cart" });
  }
});

// get cart
app.get("/api/cart", userFromHeaders, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id });
    return res.json(cart || { userId: req.user.id, items: [] });
  } catch (err) {
    console.error("GET /api/cart error:", err);
    return res.status(500).json({ message: "Failed to load cart" });
  }
});

// ---------------------------
//  ADDRESS APIs
// ---------------------------
app.post("/api/address", userFromHeaders, async (req, res) => {
  try {
    const address = await Address.create({
      userId: req.user.id,
      ...req.body,
    });
    return res.json(address);
  } catch (err) {
    console.error("POST /api/address error:", err);
    return res.status(500).json({ message: "Failed to add address" });
  }
});

app.get("/api/address", userFromHeaders, async (req, res) => {
  try {
    const addresses = await Address.find({ userId: req.user.id }).sort({
      createdAt: -1,
    });
    return res.json(addresses);
  } catch (err) {
    console.error("GET /api/address error:", err);
    return res.status(500).json({ message: "Failed to load addresses" });
  }
});

// ---------------------------
//  ORDERS (user side)
// ---------------------------
app.post("/api/orders", userFromHeaders, async (req, res) => {
  try {
    const {
      items,
      amount,
      address,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = req.body || {};

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: "No items in order" });
    }

    const orderDoc = await Order.create({
      userId: req.user.id,
      userEmail: req.user.email,
      items: items.map((i) => ({
        productId: i.id?.toString?.() || i.productId || "",
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

    return res.json(orderDoc);
  } catch (err) {
    console.error("POST /api/orders error:", err);
    return res.status(500).json({ message: "Failed to place order" });
  }
});

// user ke khud ke orders
app.get("/api/my-orders", userFromHeaders, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id }).sort({
      createdAt: -1,
    });
    return res.json(orders);
  } catch (err) {
    console.error("GET /api/my-orders error:", err);
    return res.status(500).json({ message: "Failed to load orders" });
  }
});

// ---------------------------
//  ADMIN: ORDERS DASHBOARD
// ---------------------------
app.get(
  "/api/admin/orders",
  userFromHeaders,
  requireAdmin,
  async (req, res) => {
    try {
      const orders = await Order.find({}).sort({ createdAt: -1 });
      return res.json(orders);
    } catch (err) {
      console.error("GET /api/admin/orders error:", err);
      return res.status(500).json({ message: "Failed to load admin orders" });
    }
  }
);

// future: admin order status update (optional)
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
      return res.json(updated);
    } catch (err) {
      console.error("PUT /api/admin/orders/:id/status error:", err);
      return res.status(500).json({ message: "Failed to update status" });
    }
  }
);
// PUBLIC: sab users ke liye products list
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find({ isActive: true }).sort({
      createdAt: -1,
    });
    res.json(products);
  } catch (err) {
    console.error("GET /api/products error:", err);
    res.status(500).json({ message: "Failed to load products" });
  }
});

// PUBLIC: single product by id (product page ke liye)
app.get("/api/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || !product.isActive) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  } catch (err) {
    console.error("GET /api/products/:id error:", err);
    res.status(500).json({ message: "Failed to load product" });
  }
});

// ==================================
//  SELLER PANEL / ADMIN: PRODUCTS
// ==================================
// PUBLIC: All products (for shop page)
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

// PUBLIC: Single product by id (for product detail page)
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

// PUBLIC: Similar products (same category, excluding current)
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

// list all products
app.get(
  "/api/admin/products",
  userFromHeaders,
  requireAdmin,
  async (req, res) => {
    try {
      const products = await Product.find({}).sort({ createdAt: -1 });
      return res.json(products);
    } catch (err) {
      console.error("GET /api/admin/products error:", err);
      return res.status(500).json({ message: "Failed to load products" });
    }
  }
);

// create new product
app.post(
  "/api/admin/products",
  userFromHeaders,
  requireAdmin,
  async (req, res) => {
    try {
      const body = req.body || {};
      const data = {
        name: body.name || body.title,
        title: body.title || body.name,
        description: body.description || "",
        price: Number(body.price) || 0,
        mrp: Number(body.mrp || body.price || 0),
        category: body.category || "",
        image: body.image || "",
        images:
          body.images && body.images.length
            ? body.images
            : body.image
            ? [body.image]
            : [],
        stock: Number(body.stock || 0),
        isActive: body.isActive !== false,
      };
      const product = await Product.create(data);
      return res.status(201).json(product);
    } catch (err) {
      console.error("POST /api/admin/products error:", err);
      return res.status(500).json({ message: "Failed to create product" });
    }
  }
);

// update product
app.put(
  "/api/admin/products/:id",
  userFromHeaders,
  requireAdmin,
  async (req, res) => {
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
      const product = await Product.findByIdAndUpdate(
        req.params.id,
        update,
        { new: true }
      );
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      return res.json(product);
    } catch (err) {
      console.error("PUT /api/admin/products/:id error:", err);
      return res.status(500).json({ message: "Failed to update product" });
    }
  }
);

// delete product
app.delete(
  "/api/admin/products/:id",
  userFromHeaders,
  requireAdmin,
  async (req, res) => {
    try {
      const deleted = await Product.findByIdAndDelete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Product not found" });
      }
      return res.json({ message: "Deleted" });
    } catch (err) {
      console.error("DELETE /api/admin/products/:id error:", err);
      return res.status(500).json({ message: "Failed to delete product" });
    }
  }
);

// bulk CSV upload
app.post(
  "/api/admin/products/bulk",
  userFromHeaders,
  requireAdmin,
  async (req, res) => {
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
  }
);

// ---------------------------
//  START SERVER
// ---------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`GT Mall backend running on port ${PORT}`);
});

export default app;
