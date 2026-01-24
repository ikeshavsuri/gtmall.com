import express from "express";
import Order from "../models/Order.js";
import Address from "../models/Address.js";
import { sendOrderConfirmationEmail } from "../utils/sendEmail.js";
import { generateInvoicePdf } from "../utils/generateInvoicePdf.js";


const router = express.Router();

/* ---------------------------------
   Helper: get user from headers
---------------------------------- */
function getUser(req) {
  return {
    userId: req.headers["x-user-id"] || req.headers["userid"] || req.user?.id,
    userEmail: req.headers["x-user-email"] || req.headers["useremail"] || req.user?.email,
    userName: req.headers["x-user-name"] || req.headers["username"] || ""
  };
}

/* ---------------------------------
   CREATE ORDER (after payment)
---------------------------------- */
router.post("/orders/create", async (req, res) => {
  try {
    const { userId, userEmail, userName } = getUser(req);

    if (!userId || !userEmail) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const { items, totalAmount, paymentId, addressId } = req.body;

    if (!items || !items.length || !paymentId) {
      return res.status(400).json({ success: false, message: "Invalid order data" });
    }

    let addressData = {};

    if (addressId) {
      const addr = await Address.findById(addressId);
      if (addr) {
        addressData = {
          name: addr.name,
          mobile: addr.mobile,
          address: addr.areaStreet || addr.address,
          city: addr.city,
          state: addr.state,
          pin: addr.pin
        };
      }
    }

    const order = await Order.create({
      userId,
      userEmail,
      userName,
      items,
      amount: totalAmount,
      paymentId,
      address: addressData,
      status: "Processing"
    });

    // 📧 Send confirmation email (non-blocking)
    sendOrderConfirmationEmail(order)
      .catch(err => console.error("Order email failed:", err));

    return res.status(201).json({
      success: true,
      orderId: order._id
    });

  } catch (err) {
    console.error("Order creation error:", err);
    return res.status(500).json({ success: false, message: "Order creation failed" });
  }
});

/* ---------------------------------
   MY ORDERS (user)
---------------------------------- */
router.get("/orders/mine", async (req, res) => {
  try {
    const { userId } = getUser(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const orders = await Order.find({ userId }).sort({ createdAt: -1 });
    return res.json(orders);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch orders" });
  }
});

/* ---------------------------------
   ADMIN: ALL ORDERS
---------------------------------- */
router.get("/admin/orders", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    return res.json(orders);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load admin orders" });
  }
});

/* ---------------------------------
   ADMIN: UPDATE ORDER STATUS
---------------------------------- */
router.put("/admin/orders/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    return res.json({ success: true, order });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update order" });
  }
});

export default router;
/* ---------------------------------
   ADMIN: INVOICE / SHIPPING LABEL
---------------------------------- */
router.get("/admin/orders/:id/invoice", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).send("Order not found");
    }

    generateInvoicePdf(order, res);
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to generate invoice");
  }
});
