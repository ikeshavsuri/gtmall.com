
import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  items: [{
    productId: String,
    name: String,
    price: Number,
    quantity: Number,
    image: String
  }],
  amount: Number,
  paymentStatus: { type: String, default: "created" },
  paymentId: String,
  razorpayOrderId: String,
  razorpaySignature: String,
  address: Object,
  status: { type: String, default: "Processing" }
}, { timestamps: true });

export const Order = mongoose.model("Order", orderSchema);
const cartItemSchema = new mongoose.Schema({
  productId: String,
  name: String,
  price: Number,
  quantity: Number,
  image: String
});

const cartSchema = new mongoose.Schema(
  {
    userId:    { type: String, required: true },
    userEmail: { type: String, required: true },
    items:     [cartItemSchema]
  },
  { timestamps: true }
);

const Cart = mongoose.model("Cart", cartSchema);
// GET /api/cart/mine -> current user ki cart
app.get("/api/cart/mine", async (req, res) => {
  try {
    const { userId, userEmail } = getUserFromHeaders(req);
    if (!userId || !userEmail) {
      return res.status(401).json({ message: "Auth required" });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = await Cart.create({ userId, userEmail, items: [] });
    }
    res.json(cart.items);
  } catch (err) {
    console.error("GET /api/cart/mine error:", err);
    res.status(500).json({ message: "Failed to load cart" });
  }
});

// POST /api/cart/mine -> full cart overwrite (simple approach)
app.post("/api/cart/mine", async (req, res) => {
  try {
    const { userId, userEmail } = getUserFromHeaders(req);
    if (!userId || !userEmail) {
      return res.status(401).json({ message: "Auth required" });
    }

    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ message: "Items array required" });
    }

    const cart = await Cart.findOneAndUpdate(
      { userId },
      { userEmail, items },
      { new: true, upsert: true }
    );

    res.json({ success: true, items: cart.items });
  } catch (err) {
    console.error("POST /api/cart/mine error:", err);
    res.status(500).json({ message: "Failed to save cart" });
  }
});

