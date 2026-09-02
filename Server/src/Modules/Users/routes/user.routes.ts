import { Router } from "express";
import { userController } from "../controller/user.controller.js";
import { authenticate } from "../../../Middlewares/authMiddleware.js";

const router = Router();

// Search must be before :id to avoid param collision
router.get("/search", authenticate, userController.search.bind(userController));
router.get("/me", authenticate, userController.getMe.bind(userController));
router.patch("/me", authenticate, userController.updateMe.bind(userController));
router.get("/:id", authenticate, userController.getUserById.bind(userController));

export default router;
