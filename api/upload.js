import { put } from "@vercel/blob";
import { uploadRequest } from "../lib/gallery.js";

export async function POST(request) {
  return uploadRequest(request, { put, env: process.env });
}
