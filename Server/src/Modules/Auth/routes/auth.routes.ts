import { Router } from "express";
import { authController } from "../controller/auth.controller.js";
import { authenticate } from "../../../Middlewares/authMiddleware.js";

const router = Router();

// Public
router.post("/register", authController.register.bind(authController));
router.post("/login", authController.login.bind(authController));
router.post("/refresh", authController.refresh.bind(authController));
router.post("/logout", authController.logout.bind(authController));

// Protected
router.post("/logout-all", authenticate, authController.logoutAll.bind(authController));
router.get("/me", authenticate, authController.me.bind(authController));

export default router;
