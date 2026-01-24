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
    // User
    userId: { type: String, default: "guest" },
    userEmail: { type: String, default: "" },

    // Items
    items: [orderItemSchema],

    // Amount
    amount: { type: Number, required: true },

    // -----------------
    // PAYMENT DETAILS
    // -----------------
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },

    paymentId: {
      type: String,
      index: true, // Razorpay payment_id (duplicate protection)
    },

    razorpayOrderId: {
      type: String,
      index: true, // Razorpay order_id
    },

    // -----------------
    // RETURN / REFUND
    // -----------------
    returnRequested: {
      type: Boolean,
      default: false,
    },

    refundStatus: {
      type: String,
      enum: ["none", "requested", "processed"],
      default: "none",
    },

    refundId: {
      type: String, // Razorpay refund_id
    },

    // -----------------
    // ADDRESS
    // -----------------
    address: {
      type: Object,
      required: true,
    },

    // -----------------
    // ORDER STATUS
    // -----------------
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
