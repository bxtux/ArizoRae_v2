import { env } from './env';

export async function sendGotify(title: string, message: string, priority = 5) {
  await fetch(`${env.GOTIFY_URL}/message?token=${env.GOTIFY_ADMIN_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, message, priority }),
  }).catch(() => {});
}
