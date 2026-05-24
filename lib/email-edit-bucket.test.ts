import { describe, expect, it } from "vitest";
import { classifyEmailEdit } from "@/lib/email-edit-bucket";

describe("Email Edit Bucket", () => {
  it("classifies an unchanged draft as unchanged", () => {
    const draft = "Hello, please upload your bank verification and project quote.";

    expect(classifyEmailEdit(draft, draft).bucket).toBe("unchanged");
  });

  it("treats whitespace-only formatting changes as unchanged", () => {
    const ai = "Hello   please\nupload docs";
    const sent = "hello please upload docs";

    expect(classifyEmailEdit(ai, sent).bucket).toBe("unchanged");
  });

  it("classifies a single-word tweak as a minor edit", () => {
    const ai = "Hello Amina, please upload your bank verification and your project quote soon. Thank you.";
    const sent = "Hello Amina, please upload your bank verification and your project quote today. Thank you.";

    expect(classifyEmailEdit(ai, sent).bucket).toBe("minor");
  });

  it("classifies a half-rewritten draft as a moderate edit", () => {
    const ai = "one two three four five six";
    const sent = "one two three apple banana cherry";

    expect(classifyEmailEdit(ai, sent).bucket).toBe("moderate");
  });

  it("classifies a full rewrite as a major edit", () => {
    const ai = "one two three four";
    const sent = "completely different rewritten message here now please";

    expect(classifyEmailEdit(ai, sent).bucket).toBe("major");
  });

  it("reports no_ai_draft when there is no AI baseline to compare", () => {
    const result = classifyEmailEdit("", "Reviewer wrote this from scratch.");

    expect(result.bucket).toBe("no_ai_draft");
    expect(result.changeRatio).toBe(0);
  });
});
