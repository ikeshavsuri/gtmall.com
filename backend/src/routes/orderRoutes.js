
import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { userFromHeaders, requireAdmin } from "../middleware_auth.js";
import { Order } from "../models/Order.js";

const router = express.Router();

const razor = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

router.post("/payment/create-order", userFromHeaders, async (req, res) => {
  const { amount } = req.body;
  const amtPaise = Math.round((amount || 0) * 100);
  try {
    const order = await razor.orders.create({ amount: amtPaise, currency: "INR", receipt: "gtm_" + Date.now() });
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create order" });
  }
});

router.post("/payment/verify", userFromHeaders, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, address, cartItems } = req.body;
  try {
    const hmac = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");
    if (hmac !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }
    const total = (cartItems || []).reduce((s,i)=>s + (i.price||0)*(i.quantity||1), 0);
    const order = await Order.create({
      userId: req.user.firebaseUid,
      items: (cartItems || []).map(i => ({
        productId: i.id, name: i.name, price: i.price, quantity: i.quantity, image: i.img
      })),
      amount: total,
      paymentStatus: "paid",
      paymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      razorpaySignature,
      address,
      status: "Processing"
    });
    res.json({ success: true, orderId: order._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/orders/mine", userFromHeaders, async (req, res) => {
  const orders = await Order.find({ userId: req.user.firebaseUid }).sort({ createdAt: -1 });
  res.json(orders);
});

router.get("/admin/orders", userFromHeaders, requireAdmin, async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders);
});

export default router;
