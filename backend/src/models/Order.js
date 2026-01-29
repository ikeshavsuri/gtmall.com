// backend/src/models/Order.js
import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
    },
    name: {
      type: String,
    },
    price: {
      type: Number,
    },
    quantity: {
      type: Number,
      default: 1,
    },
    image: {
      type: String,
    },
  },
  { _id: false }
);

// address ko flexible rakha hai taaki jo bhi fields frontend se aaye, sab save ho jaye
const addressSchema = new mongoose.Schema(
  {},
  { _id: false, strict: false } // strict false -> koi bhi keys aa sakti hain (name, phone, city, etc.)
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      default: [],
    },
    amount: {
      type: Number,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    paymentId: {
      type: String,
    },
    razorpayOrderId: {
      type: String,
    },
    razorpaySignature: {
      type: String,
    },
    address: {
      type: addressSchema,
    },
    status: {
      type: String,
      enum: ["Processing", "Shipped", "Delivered", "Cancelled"],
      default: "Processing",
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

const Order = mongoose.model("Order", orderSchema);

// IMPORTANT: default export add kiya hai, isse
// `import Order from "./models/Order.js";` sahi chalega
export default Order;
export { Order };

