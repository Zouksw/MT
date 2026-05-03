import { type Request, type Response, Router } from "express";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "@/config/swagger";

const router = Router();

// Serve Swagger UI at GET /api/docs
router.use("/", swaggerUi.serve);
router.get("/", swaggerUi.setup(swaggerSpec));

// Serve raw JSON spec at GET /api/docs.json
router.get("/json", (_req: Request, res: Response) => {
	res.setHeader("Content-Type", "application/json");
	res.send(swaggerSpec);
});

export default router;
