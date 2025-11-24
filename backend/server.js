// backend/server.js

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// ---------- MIDDLEWARE ----------
app.use(cors());
app.use(express.json());

// ---------- MONGODB CONNECTION ----------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected ✔"))
  .catch((err) => console.error("MongoDB Connection Error ❌", err));

// ---------- SCHEMAS & MODELS ----------
const orderSchema = new mongoose.Schema({
  userName: String,
  items: [
    {
      name: String,
      price: Number,
      qty: Number,
      image: String,
    },
  ],
  total: Number,
  status: {
    type: String,
    enum: ["Pending", "Shipped", "Delivered", "Cancelled"],
    default: "Pending",
  },
  createdAt: { type: Date, default: Date.now },
});

const Order = mongoose.model("Order", orderSchema);

// ---------- ROUTES ----------

// Test route
app.get("/", (req, res) => {
  res.send("GT Mall API Running ✔");
});

// Create a new order (called from cart.html checkout)
app.post("/api/orders", async (req, res) => {
  try {
    const { userName, items } = req.body;

    if (!items || !items.length) {
      return res
        .status(400)
        .json({ success: false, error: "Cart is empty" });
    }

    const total = items.reduce(
      (sum, item) => sum + (item.price || 0) * (item.qty || 0),
      0
    );

    const order = new Order({
      userName: userName || "Guest",
      items,
      total,
      // status defaults to "Pending"
    });

    await order.save();

    res.json({ success: true, orderId: order._id });
  } catch (e) {
    console.error("Error creating order:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Get all orders (for admin dashboard)
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (e) {
    console.error("Error fetching orders:", e);
    res.status(500).json({ error: e.message });
  }
});

// Update order status (for admin dashboard)
app.patch("/api/orders/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["Pending", "Shipped", "Delivered", "Cancelled"];

    if (!allowed.includes(status)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid status" });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!order) {
      return res
        .status(404)
        .json({ success: false, error: "Order not found" });
    }

    res.json({ success: true, order });
  } catch (e) {
    console.error("Error updating status:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ---------- START SERVER ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on PORT ${PORT}`);
});
