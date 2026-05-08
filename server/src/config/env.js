import "dotenv/config";

function parseOrigins(value) {
  const raw = (value ?? "").trim();
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      return ["https://unified-market.vercel.app"];
    }
    return [
      "http://localhost:8080",
      "http://localhost:5173",
      "http://localhost:3000",
      "http://127.0.0.1:8080",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:3000",
    ];
  }
  return raw.split(",").map((origin) => origin.trim()).filter(Boolean);
}

export const env = {
  port: Number(process.env.PORT || 4000),
  corsOrigin: parseOrigins(process.env.CORS_ORIGIN),
};
