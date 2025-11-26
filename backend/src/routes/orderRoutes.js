// backend/src/routes/orderRoutes.js
import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";

import Order from "../models/Order.js";
import Address from "../models/Address.js";

const router = express.Router();

// helper: get user identity from headers
function getUserFromHeaders(req) {
  const userId = req.headers["x-user-id"];
  const userEmail = req.headers["x-user-email"];
  const userName = req.headers["x-user-name"] || "";

  return { userId, userEmail, userName };
}

// ---------- ADDRESS APIs ----------

// GET /api/addresses/mine  → current user ke saare addresses
router.get("/addresses/mine", async (req, res) => {
  try {
    const { userId, userEmail } = getUserFromHeaders(req);
    if (!userId || !userEmail) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const addresses = await Address.find({ userId }).sort({ isDefault: -1, createdAt: 1 });
    return res.json(addresses);
  } catch (err) {
    console.error("Error fetching addresses:", err);
    return res.status(500).json({ message: "Failed to load addresses" });
  }
});

// POST /api/addresses  → new address save
router.post("/addresses", async (req, res) => {
  try {
    const { userId, userEmail } = getUserFromHeaders(req);
    if (!userId || !userEmail) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const { address, isDefault } = req.body;
    if (!address || !address.name || !address.mobile || !address.pin) {
      return res.status(400).json({ message: "Invalid address data" });
    }

    // agar isDefault true hai → pehle baaki addresses se default hata do
    if (isDefault) {
      await Address.updateMany(
        { userId },
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
    console.error("Error saving address:", err);
    return res.status(500).json({ message: "Failed to save address" });
  }
});
