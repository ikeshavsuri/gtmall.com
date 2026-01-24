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

// DB connect
connectDB();

const app = express();

app.use(cors());
app.use(express.json());
// existing singular routes agar already hain to unko rehne do
// === SINGULAR ===
/// === NEW: PLURAL ROUTES (frontend ke liye) ===

// GET /api/addresses  -> saare addresses (current user)
app.get("/api/addresses", userFromHeaders, async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const addresses = await Address.find({ userId: user.id }).sort({
      isDefault: -1, // default address sabse upar
      createdAt: 1,
    });

    return res.json(addresses);
  } catch (err) {
    console.error("GET /api/addresses error:", err);
    return res.status(500).json({ message: "Failed to load addresses" });
  }
});

// BACKWARD COMPAT: /api/addresses/mine (my_address.html me use ho raha hai)
app.get("/api/addresses/mine", userFromHeaders, async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const addresses = await Address.find({ userId: user.id }).sort({
      isDefault: -1,
      createdAt: 1,
    });

    return res.json(addresses);
  } catch (err) {
    console.error("GET /api/addresses/mine error:", err);
    return res.status(500).json({ message: "Failed to load addresses" });
  }
});

// POST /api/addresses  -> new / updated style body
// FE se mostly { address: {..}, isDefault: true/false } aa raha hai
app.post("/api/addresses", userFromHeaders, async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const body = req.body || {};
    const payload = body.address ? body.address : body; // dono format support

    if (!payload || !payload.name || !payload.mobile || !payload.pin) {
      return res.status(400).json({ message: "Invalid address data" });
    }

    const isDefault = Boolean(body.isDefault);

    // agar isDefault true hai -> pehle purane defaults hata do
    if (isDefault) {
      await Address.updateMany(
        { userId: user.id },
        { $set: { isDefault: false } }
      );
    }

    // UPDATE vs CREATE
    const id = payload._id || payload.id;
    if (id) {
      delete payload._id;
      delete payload.id;

      const updated = await Address.findOneAndUpdate(
        { _id: id, userId: user.id },
        {
          ...payload,
          isDefault,
          userEmail: user.email || "",
        },
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({ message: "Address not found" });
      }

      return res.json(updated);
    }

    // CREATE new address
    const addr = await Address.create({
      userId: user.id,
      userEmail: user.email || "",
      ...payload,
      isDefault,
    });

    return res.status(201).json(addr);
  } catch (err) {
    console.error("POST /api/addresses error:", err);
    return res.status(500).json({ message: "Failed to add address" });
  }
});

// DELETE /api/addresses/:id -> remove a saved address
app.delete("/api/addresses/:id", userFromHeaders, async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const addrId = req.params.id;
    if (!addrId) {
      return res.status(400).json({ message: "Address id is required" });
    }

    const deleted = await Address.findOneAndDelete({
      _id: addrId,
      userId: user.id,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Address not found" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/addresses/:id error:", err);
    return res.status(500).json({ message: "Failed to delete address" });
  }
});


// ================================
// RAZORPAY CREATE ORDER (SAFE)
// ================================
app.post("/api/razorpay/create-order", userFromHeaders, async (req, res) => {
  try {
    const { amount, items, address } = req.body || {};

    if (!amount) {
      return res.status(400).json({ message: "Amount is required" });
    }

    const order = await razorpay.orders.create({
      amount: Number(amount) * 100,
      currency: "INR",
      receipt: `order_${Date.now()}`,
      notes: {
        userId: req.user?.id || "guest",
        email: req.user?.email || "",
        items: JSON.stringify(items || []),
        address: JSON.stringify(address || {}),
      },
    });

    return res.json({
      orderId: order.id,
      amount: order.amount,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Razorpay create-order error:", err);
    return res.status(500).json({ message: "Failed to create Razorpay order" });
  }
});
// ================================
// RAZORPAY WEBHOOK (AUTO ORDER CREATE)
// ================================
app.post(
  "/api/razorpay/webhook",
  express.raw({ type: "application/json" }),
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

      const payload = JSON.parse(req.body.toString());

      if (payload.event !== "payment.captured") {
        return res.json({ ignored: true });
      }

      const payment = payload.payload.payment.entity;

      // 🔁 Duplicate protection
      const exists = await Order.findOne({ paymentId: payment.id });
      if (exists) {
        return res.json({ ok: true, duplicate: true });
      }

      let items = [];
      let address = null;

      try {
        if (payment.notes?.items) {
          items = JSON.parse(payment.notes.items);
        }
        if (payment.notes?.address) {
          address = JSON.parse(payment.notes.address);
        }
      } catch {}

      await Order.create({
        userId: payment.notes?.userId || "guest",
        userEmail: payment.email || "",
        items,
        amount: payment.amount / 100,
        paymentStatus: "paid",
        paymentId: payment.id,
        razorpayOrderId: payment.order_id,
        address,
        status: "Processing",
      });

      return res.json({ ok: true });
    } catch (err) {
      console.error("Webhook error:", err);
      return res.status(500).send("Webhook error");
    }
  }
);

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

// Backward-compatible aliases for older frontend endpoints
app.post("/api/cart/mine", userFromHeaders, async (req, res) => {
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
    console.error("POST /api/cart/mine error:", err);
    return res.status(500).json({ message: "Failed to save cart" });
  }
});

app.get("/api/cart/mine", userFromHeaders, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      return res.json([]);
    }
    return res.json(cart.items || []);
  } catch (err) {
    console.error("GET /api/cart/mine error:", err);
    return res.status(500).json({ message: "Failed to load cart" });
  }
});


// ---------------------
// ADDRESS APIs
// ---------------------
app.post("/api/address", userFromHeaders, async (req, res) => {
  try {
    const body = req.body || {};

    // basic validation
    if (!body.name || !body.mobile || !body.pin) {
      return res.status(400).json({ message: "Invalid address data" });
    }

    // create address
    const address = await Address.create({
      userId: req.user.id,   // make sure userFromHeaders sets req.user
      ...body,
    });

    return res.status(201).json(address);
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

// GET /api/orders/mine
// Logged-in user ke saare orders (My Orders page)
app.get("/api/orders/mine", userFromHeaders, async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      return res.status(401).json({ message: "Not logged in" });
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

// BACKWARD COMPAT / alias
// GET /api/my-orders
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
// USER: request refund
app.post("/api/orders/:id/request-refund", userFromHeaders, async (req, res) => {
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

    return res.json({ success: true });
  } catch (err) {
    console.error("request refund error:", err);
    return res.status(500).json({ message: "Failed to request refund" });
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
// ADMIN: approve refund
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

      const refund = await razorpay.payments.refund(order.paymentId, {
        amount: Math.round(order.amount * 100),
      });

      order.paymentStatus = "refunded";
      order.refundStatus = "processed";
      order.refundId = refund.id;
      order.status = "Cancelled";

      await order.save();

      return res.json({
        success: true,
        refundId: refund.id,
      });
    } catch (err) {
      console.error("admin refund error:", err);
      return res.status(500).json({ message: "Refund failed" });
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
  console.log(`Server running on port ${PORT}`);
});

export default app;
