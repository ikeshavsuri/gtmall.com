// backend/src/models/Address.js
import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },       // Firebase UID / x-user-id
    userEmail: { type: String, required: true },    // x-user-email

    name: { type: String, required: true },
    mobile: { type: String, required: true },
    altMobile: { type: String },
    email: { type: String, required: true },

    pin: { type: String, required: true },
    locality: { type: String, required: true },
    areaStreet: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    landmark: { type: String },

    type: { type: String, default: "Home" },        // Home / Work / Other
    isDefault: { type: Boolean, default: false }
  },
  { timestamps: true }
);

const Address = mongoose.model("Address", addressSchema);
export default Address;
