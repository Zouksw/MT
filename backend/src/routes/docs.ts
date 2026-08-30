import { type Request, type Response, Router } from "express";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "@/config/swagger";
import { authenticate } from "@/middleware/auth";

const router = Router();

// Authenticated only (v3.3.0 batch 3 / D12: authenticate level): the spec
// enumerates the platform's full endpoint surface — an anonymous map of the
// API is reconnaissance value with no user value. Consumers pass the same
// Bearer/x-api-key credentials the described endpoints require.
router.use("/", authenticate);

// Serve Swagger UI at GET /api/docs
router.use("/", swaggerUi.serve);
router.get("/", swaggerUi.setup(swaggerSpec));

// Serve raw JSON spec at GET /api/docs.json
router.get("/json", (_req: Request, res: Response) => {
	res.setHeader("Content-Type", "application/json");
	res.send(swaggerSpec);
});

export default router;
