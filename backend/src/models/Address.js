// backend/src/models/Address.js
import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },

    name: { type: String, default: "" },
    phone: { type: String, default: "" },

    addressLine1: { type: String, default: "" },
    addressLine2: { type: String, default: "" },

    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },

    landmark: { type: String, default: "" },

    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Address = mongoose.model("Address", addressSchema);

export default Address;
export { Address };
