import { get, list } from "@vercel/blob";
import { photosRequest } from "../lib/gallery.js";

export async function GET(request) {
  return photosRequest(request, { get, list, env: process.env });
}
