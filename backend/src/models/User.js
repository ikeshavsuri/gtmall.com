
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true },
  name: String,
  email: { type: String, required: true, unique: true },
  isAdmin: { type: Boolean, default: false }
}, { timestamps: true });

export const User = mongoose.model("User", userSchema);
