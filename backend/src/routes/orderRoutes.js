/// backend/src/routes/orderRoutes.js
import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import Order from "../models/Order.js";
import Address from "../models/Address.js";

const router = express.Router();

/* ------------------ helpers ------------------ */
function getUserFromHeaders(req) {
  return {
    userId: req.headers["x-user-id"],
    userEmail: req.headers["x-user-email"],
    userName: req.headers["x-user-name"] || ""
  };
}

/* ------------------ CREATE ORDER AFTER PAYMENT ------------------ */
router.post("/orders/create", async (req, res) => {
  try {
    const { userId, userEmail, userName } = getUserFromHeaders(req);
    if (!userId || !userEmail) {
      return res.status(401).json({ message: "User not logged in" });
    }

    const {
      items,
      totalAmount,
      paymentId,
      addressId
    } = req.body;

    if (!items || !items.length || !paymentId) {
      return res.status(400).json({ message: "Invalid order data" });
    }

    const address = await Address.findById(addressId);
    if (!address) {
      return res.status(400).json({ message: "Address not found" });
    }

    const order = await Order.create({
      userId,
      userEmail,
      userName,
      items,
      amount: totalAmount,
      paymentId,
      address: {
        name: address.name,
        mobile: address.mobile,
        address: address.address,
        city: address.city,
        state: address.state,
        pin: address.pin
      },
      status: "Processing"
    });

    return res.status(201).json({
      success: true,
      orderId: order._id
    });

  } catch (err) {
    console.error("Order create failed:", err);
    return res.status(500).json({ message: "Order creation failed" });
  }
});

/* ------------------ MY ORDERS ------------------ */
router.get("/orders/mine", async (req, res) => {
  try {
    const { userId } = getUserFromHeaders(req);
    const orders = await Order.find({ userId }).sort({ createdAt: -1 });
    return res.json(orders);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch orders" });
  }
});

/* ------------------ ADMIN ORDERS ------------------ */
router.get("/admin/orders", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    return res.json(orders);
  } catch (err) {
    return res.status(500).json({ message: "Failed to load admin orders" });
  }
});

export default router;
