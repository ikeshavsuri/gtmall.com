// backend/src/server.js

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import orderRoutes from "./routes/orderRoutes.js";

dotenv.config();

const app = express();

// ---------- MIDDLEWARES ----------

// Parse JSON body
app.use(express.json());

// CORS setup
const allowedOrigins = [
  process.env.CLIENT_ORIGIN,           // e.g. https://gtmall.run.place
  "https://gtmall.run.place",          // hard-coded safety
  "http://localhost:5500",             // local file server (VS Code Live Server)
  "http://localhost:3000",             // just in case for local frontend
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser / curl / Postman (no origin)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn("Blocked CORS origin:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "x-user-id",
      "x-user-email",
      "x-user-name",
      "Authorization",
    ],
  })
);

// Handle preflight requests
app.options("*", cors());

// ---------- DB CONNECTION ----------
connectDB();

// ---------- ROUTES ----------
app.get("/", (req, res) => {
  res.send("GT Mall backend running");
});

// All API routes
app.use("/api", orderRoutes);

// ---------- START SERVER ----------
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log("Backend listening on port " + port);
  console.log("Allowed origins:", allowedOrigins);
});
