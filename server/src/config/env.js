import "dotenv/config";

function parseOrigins(value) {
  if (!value || value.trim().length === 0) {
    return true;
  }
  return value.split(",").map((origin) => origin.trim()).filter(Boolean);
}

export const env = {
  port: Number(process.env.PORT || 4000),
  corsOrigin: parseOrigins(process.env.CORS_ORIGIN),
};
