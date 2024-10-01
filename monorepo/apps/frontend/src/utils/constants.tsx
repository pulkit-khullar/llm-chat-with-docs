const apiBasePath = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : `http://localhost:3001`;
export const apiBaseUrl = `${apiBasePath}`;
