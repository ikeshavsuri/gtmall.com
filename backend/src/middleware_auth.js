
import { User } from "./models/User.js";

export const userFromHeaders = async (req, res, next) => {
  const uid = req.header("x-user-id");
  const email = req.header("x-user-email");
  const name = req.header("x-user-name") || "User";
  if (!uid || !email) return res.status(401).json({ message: "Auth required" });
  let user = await User.findOne({ firebaseUid: uid });
  if (!user) {
    user = await User.create({
      firebaseUid: uid,
      email,
      name,
      isAdmin: email === process.env.ADMIN_EMAIL
    });
  }
  req.user = user;
  next();
};

export const requireAdmin = (req, res, next) => {
  if (!req.user?.isAdmin) return res.status(403).json({ message: "Admin only" });
  next();
};
