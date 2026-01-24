import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  productId: String,
  name: String,
  price: Number,
  quantity: Number,
  image: String,
});

const orderSchema = new mongoose.Schema(
  {
    userId: { type: String, default: "guest" },
    userEmail: { type: String, default: "" },

    items: [orderItemSchema],

    amount: { type: Number, required: true },

    // Payment
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentId: { type: String, index: true }, // Razorpay payment id
    razorpayOrderId: String,

    // Return / Refund
    returnRequested: { type: Boolean, default: false },
    refundStatus: {
      type: String,
      enum: ["none", "requested", "processed"],
      default: "none",
    },
    refundId: String,

    address: Object,

    status: {
      type: String,
      enum: ["Processing", "Shipped", "Delivered", "Cancelled"],
      default: "Processing",
    },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
export default Order;
