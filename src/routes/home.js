// src/routes/home.js
import { homePage } from '../pages/home.js';
import { html, getLang } from '../utils.js';
import { DB } from '../db.js';

export async function handleHome(env, req) {
  const lang = getLang(req);
  const url = new URL(req.url);
  // Build the real origin (scheme://host) so curl examples use the live URL.
  const origin = `${url.protocol}//${url.host}`;
  const db = new DB(env.DB);
  const randomIdLen = await db.getRandomIdLen();
  const contactEmail = await db.getContactEmail();
  return html(homePage(origin, lang, randomIdLen, contactEmail));
}
