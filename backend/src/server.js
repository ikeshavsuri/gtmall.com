import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import fetch from "node-fetch";
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


const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || "2022-09-01";
const CASHFREE_ENV = process.env.CASHFREE_ENV || "sandbox";

const CASHFREE_BASE_URL =
  CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

// Create Cashfree order and return payment_session_id + order_id
app.post("/api/cashfree/create-order", userFromHeaders, async (req, res) => {
  try {
    const { amount, customerPhone } = req.body || {};
    if (!amount) {
      return res.status(400).json({ message: "Amount is required" });
    }
    if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
      return res
        .status(500)
        .json({ message: "Cashfree keys not configured on server" });
    }

    const user = req.user || {};
    const cfOrderId = `order_${Date.now()}`;

    const payload = {
      order_id: cfOrderId,
      order_amount: Number(amount),
      order_currency: "INR",
      customer_details: {
        customer_id: user.id || user.email || "guest",
        customer_name: user.name || user.email || "Guest",
        customer_email: user.email || "",
        customer_phone: customerPhone || "",
      },
      order_meta: {
        // Cashfree will replace {order_id} with actual order id
        return_url: "https://gtmall.run.place/checkout.html?cf_order_id={order_id}",
      },
    };

    const cfRes = await fetch(CASHFREE_BASE_URL + "/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": CASHFREE_API_VERSION,
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await cfRes.json();
    if (!cfRes.ok) {
      console.error("Cashfree create order error:", data);
      return res
        .status(500)
        .json({ message: "Failed to create Cashfree order", details: data });
    }

    return res.json({
      orderId: data.order_id || cfOrderId,
      cfOrderId: data.order_id || cfOrderId,
      paymentSessionId: data.payment_session_id,
    });
  } catch (err) {
    console.error("Cashfree create-order error:", err);
    return res
      .status(500)
      .json({ message: "Failed to create payment order" });
  }
});

// Confirm Cashfree payment and create local Order document
app.post("/api/cashfree/confirm", userFromHeaders, async (req, res) => {
  try {
    const { cfOrderId, items, amount, address } = req.body || {};
    if (!cfOrderId) {
      return res.status(400).json({ message: "cfOrderId is required" });
    }
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: "No items in order" });
    }

    if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
      return res
        .status(500)
        .json({ message: "Cashfree keys not configured on server" });
    }

    const verifyRes = await fetch(
      `${CASHFREE_BASE_URL}/orders/${cfOrderId}`,
      {
        method: "GET",
        headers: {
          "x-api-version": CASHFREE_API_VERSION,
          "x-client-id": CASHFREE_APP_ID,
          "x-client-secret": CASHFREE_SECRET_KEY,
        },
      }
    );

    const orderInfo = await verifyRes.json();
    if (!verifyRes.ok) {
      console.error("Cashfree get order error:", orderInfo);
      return res.status(500).json({
        message: "Failed to verify payment with Cashfree",
        details: orderInfo,
      });
    }

    if (orderInfo.order_status !== "PAID") {
      return res.status(400).json({
        success: false,
        message: "Order is not paid yet",
        status: orderInfo.order_status,
      });
    }

    const totalAmount = Number(amount || orderInfo.order_amount || 0);

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
      amount: totalAmount,
      paymentStatus: "paid",
      paymentId: orderInfo.cf_order_id || "",
      razorpayOrderId: orderInfo.order_id || "",
      razorpaySignature: "", // not used for Cashfree
      address,
      status: "Processing",
    });

    return res.json({ success: true, order: orderDoc });
  } catch (err) {
    console.error("Cashfree confirm error:", err);
    return res
      .status(500)
      .json({ message: "Failed to confirm payment" });
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


// GET /api/orders/mine  -> list of orders for current user (used in my_orders.html)
app.get("/api/orders/mine", userFromHeaders, async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      return res.status(401).json({ message: "Not logged in" });
    }
    const orders = await Order.find({ userId: user.id }).sort({ createdAt: -1 });
    return res.json(orders);
  } catch (err) {
    console.error("GET /api/orders/mine error:", err);
    return res.status(500).json({ message: "Failed to load orders" });
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