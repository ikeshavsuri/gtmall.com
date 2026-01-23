const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const Razorpay = require("razorpay");

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// =======================
// DATABASE CONNECT
// =======================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("Mongo Error:", err));

// =======================
// MODELS
// =======================
const Product = require("./models/product");
const Order = require("./models/Order");
const User = require("./models/User");

// =======================
// PRODUCTS (SELLER + INDEX)
// =======================

// ADD PRODUCT
app.post("/api/products", async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET ALL PRODUCTS
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// FEATURED PRODUCTS
app.get("/api/products/featured", async (req, res) => {
  try {
    const products = await Product.find({ featured: true }).limit(8);
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =======================
// ORDERS
// =======================

// CREATE ORDER
app.post("/api/orders", async (req, res) => {
  try {
    const order = new Order(req.body);
    await order.save();
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET USER ORDERS
app.get("/api/orders/:userId", async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.params.userId });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =======================
// RAZORPAY (ISOLATED)
// =======================
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || ""
});

app.post("/api/razorpay/order", async (req, res) => {
  try {
    const options = {
      amount: req.body.amount * 100,
      currency: "INR",
      receipt: "order_rcptid_" + Date.now()
    };
    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =======================
// SERVER START
// =======================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
