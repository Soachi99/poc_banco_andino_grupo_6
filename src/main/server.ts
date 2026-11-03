import { createApp } from './createApp.js';

const port = Number(process.env.PORT ?? 3001);
const app = createApp();

app.listen(port, () => {
  console.log(`Data Privacy Vault listening on http://localhost:${port}`);
});
