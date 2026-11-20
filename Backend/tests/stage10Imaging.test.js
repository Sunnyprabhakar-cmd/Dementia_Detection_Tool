import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { app } from "../server.js";
import { resolveSafeImagingExtension } from "../services/imagingService.js";

test("resolveSafeImagingExtension allows medical formats and rejects unsafe extensions", () => {
  assert.equal(resolveSafeImagingExtension("scan.nii"), ".nii");
  assert.equal(resolveSafeImagingExtension("brain.NII.GZ"), ".nii.gz");
  assert.equal(resolveSafeImagingExtension("slice.dcm"), ".dcm");
  assert.equal(resolveSafeImagingExtension("series.zip"), ".zip");
  assert.throws(() => resolveSafeImagingExtension("photo.png"));
  assert.throws(() => resolveSafeImagingExtension("malware.exe"));
});

test("imaging routes require authentication (401)", async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    for (const [method, path] of [
      ["POST", "/api/imaging/upload"],
      ["GET", "/api/imaging/screening/1"],
      ["DELETE", "/api/imaging/1"]
    ]) {
      const res = await fetch(`${baseUrl}${path}`, { method });
      assert.equal(res.status, 401);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
