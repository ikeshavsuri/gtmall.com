
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import orderRoutes from "./routes/orderRoutes.js";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*", credentials: true }));

connectDB();

app.get("/", (req, res) => {
  res.send("GT Mall backend running");
});

app.use("/api", orderRoutes);

const port = process.env.PORT || 5000;
app.listen(port, () => console.log("Backend listening on port " + port));
