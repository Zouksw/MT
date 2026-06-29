process.env.NODE_ENV = "test";
// Integration tests run the app in-process, so the app's own Prisma client
// (the @/lib singleton, which reads DATABASE_URL) must point at the seeded
// mt_db — the same database the old HTTP-based tests hit. Previously the app
// ran as a separate production server, so this URL only mattered for ad-hoc
// PrismaClients; now it drives the in-process app too.
process.env.DATABASE_URL =
	process.env.DATABASE_URL ||
	"postgresql://mt_user:mt_password@localhost:5432/mt_db";
process.env.JWT_SECRET =
	process.env.JWT_SECRET ||
	"test-secret-key-for-jwt-testing-purposes-only-32chars";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
process.env.SESSION_SECRET =
	process.env.SESSION_SECRET ||
	"test-session-key-for-testing-purposes-only-32-chars-min";
process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
process.env.INFERENCE_URL =
	process.env.INFERENCE_URL || "http://localhost:10810";
