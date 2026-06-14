import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { imagineRouter, hasHfToken, hfImageModel } from './routes/imagine.js';
import { isOriginAllowed, parseAllowedOrigins, rateLimitMiddleware } from './security.js';

const app = express();
const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGINS ?? '');
const PORT = Number(process.env.PORT ?? 8787);

app.use(cors({
  origin(origin, callback) {
    if (isOriginAllowed(origin, allowedOrigins)) callback(null, true);
    else callback(new Error('CORS origin not allowed'));
  },
}));
app.use(express.json({ limit: '8mb' }));
app.use('/api', rateLimitMiddleware());
app.use('/api', imagineRouter);

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'sonicraft-backend',
    hfConfigured: hasHfToken(),
    hfImageModel,
    time: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`[sonicraft] backend listening on http://localhost:${PORT}`);
  if (!hasHfToken()) {
    console.warn('[sonicraft] HF_TOKEN missing; AI image generation disabled.');
  }
});
