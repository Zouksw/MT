/**
 * Environment Variable Validation Utility
 *
 * Validates that all required environment variables are set at application startup.
 * Call this utility early in the app initialization to fail fast if configuration is missing.
 */

interface EnvVarConfig {
  name: string;
  required: boolean;
  defaultValue?: string;
  description: string;
}

const REQUIRED_ENV_VARS: EnvVarConfig[] = [
  {
    name: "NEXT_PUBLIC_API_URL",
    required: true,
    description: "Backend API endpoint for the IoTDB Enhanced service",
  },
  {
    name: "NEXT_PUBLIC_IOTDB_REST_URL",
    required: false,
    defaultValue: "http://localhost:18080",
    description: "IoTDB REST API endpoint for direct database access",
  },
];

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  envVars: Record<string, string>;
}

/**
 * Validates all environment variables and returns the validation result
 */
export function validateEnvVars(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const envVars: Record<string, string> = {};

  for (const config of REQUIRED_ENV_VARS) {
    const value = process.env[config.name] || config.defaultValue || "";

    if (config.required && !value) {
      errors.push(`Required environment variable "${config.name}" is missing. ${config.description}`);
    } else if (!value) {
      warnings.push(`Optional environment variable "${config.name}" is not set. ${config.description}`);
    }

    envVars[config.name] = value;
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    envVars,
  };
}

/**
 * Gets an environment variable or throws an error if it's missing
 */
export function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Gets an environment variable with a fallback value
 */
export function getEnvVarOrDefault(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

/**
 * Logs validation results to console (for development)
 */
export function logEnvValidation(result: ValidationResult): void {
  if (typeof window === "undefined") {
    // Server-side only logging
    // eslint-disable-next-line no-console
    if (result.warnings.length > 0) {
      // eslint-disable-next-line no-console
      console.warn("Environment Variable Warnings:");
      // eslint-disable-next-line no-console
      result.warnings.forEach((warning) => console.warn(`  - ${warning}`));
    }

    if (result.errors.length > 0) {
      // eslint-disable-next-line no-console
      console.error("Environment Variable Errors:");
      // eslint-disable-next-line no-console
      result.errors.forEach((error) => console.error(`  - ${error}`));
    }
  }
}

/**
 * Validates API URL format
 */
export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validates all API endpoints are properly configured
 */
export function validateApiEndpoints(): ValidationResult {
  const result = validateEnvVars();
  const apiUrl = result.envVars.NEXT_PUBLIC_API_URL;
  const iotdbUrl = result.envVars.NEXT_PUBLIC_IOTDB_REST_URL;

  if (apiUrl && !isValidUrl(apiUrl)) {
    result.errors.push(`NEXT_PUBLIC_API_URL is not a valid URL: ${apiUrl}`);
    result.isValid = false;
  }

  if (iotdbUrl && !isValidUrl(iotdbUrl)) {
    result.errors.push(`NEXT_PUBLIC_IOTDB_REST_URL is not a valid URL: ${iotdbUrl}`);
    result.isValid = false;
  }

  return result;
}
