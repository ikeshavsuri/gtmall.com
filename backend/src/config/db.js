import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const uri =
      process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      process.env.MONGO_URL ||
      "";

    if (!uri) {
      console.error(
        "Mongo error: no Mongo connection string found. Please set MONGO_URI (or MONGODB_URI / MONGO_URL) env var."
      );
      throw new Error("Missing Mongo connection string env (MONGO_URI)");
    }

    await mongoose.connect(uri, { dbName: "gtmall" });
    console.log("MongoDB connected");
  } catch (err) {
    console.error("Mongo error:", err.message);
    // In serverless / Render env, better not crash immediately; but existing code exited.
    // Keep same behaviour so failures are visible in logs.
    process.exit(1);
  }
};
