
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
