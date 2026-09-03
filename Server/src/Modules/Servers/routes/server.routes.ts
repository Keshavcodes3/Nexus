import { Router } from "express";
import { serverController } from "../controller/server.controller.js";
import { authenticate } from "../../../Middlewares/authMiddleware.js";

const router = Router();

router.use(authenticate);

router.post("/", serverController.createServer.bind(serverController));

router.get("/slug/:slug", serverController.getServerBySlug.bind(serverController));
router.get("/:id", serverController.getServerById.bind(serverController));

router.patch("/:id", serverController.updateServer.bind(serverController));
router.delete("/:id", serverController.deleteServer.bind(serverController));

router.post("/:id/archive", serverController.archiveServer.bind(serverController));
router.post("/:id/restore", serverController.restoreServer.bind(serverController));

export default router;
