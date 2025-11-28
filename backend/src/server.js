// server.js (FINAL VERSION)

require("dotenv").config();
const express  = require("express");
const path     = require("path");
const Razorpay = require("razorpay");
const crypto   = require("crypto");
const cors     = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());
app.use(cors());

// -------------------- MONGODB CONNECT --------------------
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

// -------------------- ADDRESS MODEL --------------------
const addressSchema = new mongoose.Schema(
  {
    userId:    { type: String },          // optional: Firebase UID
    userEmail: { type: String, required: true },

    name:      { type: String, required: true },
    mobile:    { type: String, required: true },
    altMobile: { type: String },
    email:     { type: String, required: true },

    pin:       { type: String, required: true },
    locality:  { type: String, required: true },
    areaStreet:{ type: String, required: true },
    city:      { type: String, required: true },
    state:     { type: String, required: true },
    landmark:  { type: String },

    type:      { type: String, default: "Home" },
    isDefault: { type: Boolean, default: false }
  },
  { timestamps: true }
);

const Address = mongoose.model("Address", addressSchema);

// -------------------- STATIC FILES --------------------
app.use(express.static(path.join(__dirname, "public")));

// -------------------- HELPERS --------------------
function getUserFromHeaders(req) {
  return {
    userId:    req.headers["x-user-id"] || null,
    userEmail: req.headers["x-user-email"] || null,
    userName:  req.headers["x-user-name"] || null
  };
}

// -------------------- ADDRESS APIs --------------------

// GET  /api/addresses/mine  -> current user ke saare addresses
app.get("/api/addresses/mine", async (req, res) => {
  try {
    const { userEmail } = getUserFromHeaders(req);
    if (!userEmail) {
      return res.status(401).json({ message: "Auth required" });
    }

    const addresses = await Address.find({ userEmail }).sort({
      isDefault: -1,
      createdAt: 1
    });

    return res.json(addresses);
  } catch (err) {
    console.error("GET /api/addresses/mine error:", err);
    return res.status(500).json({ message: "Failed to load addresses" });
  }
});

// POST /api/addresses  -> naya address save
app.post("/api/addresses", async (req, res) => {
  try {
    const { userId, userEmail } = getUserFromHeaders(req);
    if (!userEmail) {
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

    // Agar is address ko default bana rahe ho to purane default hata do
    if (isDefault) {
      await Address.updateMany(
        { userEmail },
        { $set: { isDefault: false } }
      );
    }

    const doc = await Address.create({
      userId,
      userEmail,
      ...address,
      isDefault: !!isDefault
    });

    return res.status(201).json({ success: true, address: doc });
  } catch (err) {
    console.error("POST /api/addresses error:", err);
    return res.status(500).json({ message: "Failed to save address" });
  }
});


// -------------------- RAZORPAY INIT --------------------
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create order
app.post("/api/create-order", async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount) {
      return res.status(400).json({ error: "Amount is required" });
    }

    const options = {
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: "gtm_" + Date.now()
    };

    const order = await razorpay.orders.create(options);
    res.json(order);

  } catch (error) {
    console.error("Order Create Error:", error);
    res.status(500).json({ error: "Order creation failed" });
  }
});

// Verify payment
app.post("/api/verify-payment", (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      address,
      cartItems
    } = req.body;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (expectedSign === razorpay_signature) {
      console.log("Payment Verified → ORDER:", razorpay_order_id);

      // TODO: yahan Order ko MongoDB me save bhi kar sakte ho (future step)

      return res.json({
        success: true,
        orderId: razorpay_order_id
      });
    }

    res.json({ success: false });

  } catch (error) {
    console.error("Verify Error:", error);
    res.status(500).json({ error: "Verification error" });
  }
});

// SPA style fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// -------------------- START SERVER --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`GT Mall running on port ${PORT}`));
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

