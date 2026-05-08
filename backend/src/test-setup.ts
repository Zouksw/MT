process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
	process.env.DATABASE_URL ||
	"postgresql://test:test@localhost:5432/mt_test";
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
