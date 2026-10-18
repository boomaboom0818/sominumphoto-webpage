import { del, list, put } from "@vercel/blob";
import { deleteRequest, uploadRequest } from "../lib/gallery.js";

export async function POST(request) {
  return uploadRequest(request, { put, env: process.env });
}

export async function DELETE(request) {
  return deleteRequest(request, { del, list, env: process.env });
}
