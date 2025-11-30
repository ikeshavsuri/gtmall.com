// backend/src/models/Address.js
import mongoose from "mongoose";

// Yeh schema frontend ke address fields ke saath sync hai
// so that /api/addresses aur /api/addresses/mine properly kaam karein.
const addressSchema = new mongoose.Schema(
  {
    // Firebase user id
    userId: { type: String, required: true },

    // Optional – easy lookup / debugging
    userEmail: { type: String, default: "" },

    // Name / phone
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    altMobile: { type: String, default: "" },

    email: { type: String, default: "" },

    // Address parts (match frontend)
    pin: { type: String, required: true },
    locality: { type: String, default: "" },
    areaStreet: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    landmark: { type: String, default: "" },

    type: { type: String, default: "Home" },

    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Address = mongoose.model("Address", addressSchema);

export default Address;
export { Address };
