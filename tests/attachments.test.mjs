import assert from "node:assert/strict";
import test from "node:test";

import { dataUrlToAttachment, filterImageFiles, MAX_ATTACHMENTS } from "../public/attachments.js";

test("keeps only a bounded set of reasonably sized images", () => {
  const files = [
    { type: "application/pdf", size: 100 },
    { type: "image/png", size: 1200 },
    { type: "image/jpeg", size: 20 * 1024 * 1024 },
    { type: "image/webp", size: 800 }
  ];

  const accepted = filterImageFiles(files, MAX_ATTACHMENTS - 1);
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].type, "image/png");
});

test("stores a single base64 payload instead of duplicating the data URL", () => {
  const attachment = dataUrlToAttachment(
    { name: "shot.png", type: "image/png" },
    "data:image/png;base64,QUJD"
  );
  assert.equal(attachment.base64, "QUJD");
  assert.equal(attachment.name, "shot.png");
  assert.ok(attachment.id);
});
