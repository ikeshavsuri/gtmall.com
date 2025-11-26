
import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: "gtmall" });
    console.log("MongoDB connected");
  } catch (err) {
    console.error("Mongo error:", err.message);
    process.exit(1);
  }
};
