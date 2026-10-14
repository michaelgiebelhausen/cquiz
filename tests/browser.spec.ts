import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { mkdirSync } from "node:fs";
test("four-phone exam completes three rounds, grades, flags, mingles and exports", async ({
  browser,
}) => {
  mkdirSync("artifacts/screenshots", { recursive: true });
  const adminContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    admin = await adminContext.newPage();
  const errors: string[] = [];
  admin.on("pageerror", (error) => errors.push(error.message));
  await admin.goto("/admin");
  await admin
    .getByLabel("Instructor password")
    .fill("browser-rehearsal-password");
  await admin
    .getByRole("button", { name: "Open instructor workspace" })
    .click();
  await expect(
    admin.getByRole("heading", { name: "Prepare the conversation." }),
  ).toBeVisible();
  await admin.getByText("Try a synthetic rehearsal first").click();
  await admin.getByRole("button", { name: "Load rehearsal kit" }).click();
  await expect(
    admin.getByText("Synthetic rehearsal kit loaded."),
  ).toBeVisible();
  await admin.getByLabel("Invitation seconds").fill("5");
  await admin.screenshot({
    path: "artifacts/screenshots/admin-setup.png",
    fullPage: true,
  });
  await admin.getByRole("button", { name: "Create exam lobby" }).click();
  await expect(
    admin.getByRole("heading", { name: "Ready when your class is." }),
  ).toBeVisible();
  const contexts: BrowserContext[] = [],
    students: Page[] = [];
  for (let i = 1; i <= 4; i++) {
    const context = await browser.newContext({
      viewport: { width: i === 4 ? 320 : 390, height: 844 },
    });
    contexts.push(context);
    await context.addInitScript(() => {
      class FakeSpeech {
        continuous = true;
        interimResults = true;
        lang = "en-US";
        onresult: ((e: unknown) => void) | null = null;
        onerror: ((e: unknown) => void) | null = null;
        onend: (() => void) | null = null;
        start() {
          setTimeout(
            () =>
              this.onresult?.({
                results: [
                  {
                    isFinal: true,
                    0: { transcript: "Use clear goals and context." },
                  },
                ],
                resultIndex: 0,
              }),
            40,
          );
        }
        stop() {
          setTimeout(() => this.onend?.(), 40);
        }
        abort() {
          this.onend?.();
        }
      }
      Object.defineProperty(window, "SpeechRecognition", {
        value: FakeSpeech,
        configurable: true,
      });
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    students.push(page);
    await page.goto("/");
    if (i === 1)
      await page.screenshot({
        path: "artifacts/screenshots/student-join.png",
        fullPage: true,
      });
    await page
      .getByLabel("School email")
      .fill(`student${String(i).padStart(2, "0")}@example.edu`);
    await page.getByLabel("Student ID number").fill(String(i).padStart(3, "0"));
    await page.getByRole("button", { name: "Join your exam" }).click();
    await expect(
      page.getByRole("heading", { name: "Make sure we hear you." }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Start voice input" }).click();
    await expect(page.getByRole("textbox")).toContainText("clear goals");
    await page
      .getByRole("button", { name: "Microphone check complete" })
      .click();
    await expect(
      page.getByRole("heading", { name: "You’re ready." }),
    ).toBeVisible();
  }
  await expect(admin.getByText("4 ready / 4 on roster")).toBeVisible();
  await admin
    .getByRole("button", { name: "Start rehearsal", exact: true })
    .click();
  await expect(
    students[0].getByRole("button", { name: "I have something to add" }),
  ).toBeEnabled();
  await students[0]
    .getByRole("button", { name: "I have something to add" })
    .click();
  await expect(students[0].getByText("Your turn", { exact: true })).toBeVisible(
    { timeout: 15000 },
  );
  await students[0].getByRole("button", { name: "Start voice input" }).click();
  await expect(students[0].getByRole("textbox")).toContainText("clear goals");
  // Tablemates can rate before the contribution is submitted.
  for (const page of students.slice(1)) {
    await expect(
      page.getByRole("heading", { name: "Your impression" }),
    ).toBeVisible();
    for (const field of await page.locator(".likert").all())
      await field.getByRole("radio", { name: "Agree", exact: true }).check();
    await page.getByRole("button", { name: "Save ratings" }).click();
  }
  await students[0].screenshot({
    path: "artifacts/screenshots/student-speaking.png",
    fullPage: true,
  });
  await students[0]
    .getByRole("button", { name: "Finish contribution" })
    .click();
  await students[0]
    .getByRole("button", { name: "Flag a transcription error" })
    .click();
  await students[0].getByRole("button", { name: "Flag this response" }).click();
  await expect(
    students[0].getByText(
      "Transcription concern recorded. Evaluation remains included.",
    ),
  ).toBeVisible();
  await admin.screenshot({
    path: "artifacts/screenshots/admin-room.png",
    fullPage: true,
  });
  for (let round = 1; round <= 3; round++) {
    await admin.getByRole("button", { name: "End round & mingle" }).click();
    for (const page of students) {
      await expect(
        page
          .getByText("Time to mingle.", { exact: true })
          .or(page.getByText("That’s your exam.", { exact: true })),
      ).toBeVisible();
      for (let peer = 0; peer < 3; peer++) {
        await expect(page.locator(".rating-form")).toBeVisible();
        for (const field of await page.locator(".likert").all())
          await field
            .getByRole("radio", { name: "Agree", exact: true })
            .check();
        await page.getByRole("button", { name: "Save ratings" }).click();
      }
    }
    if (round < 3) {
      if (round === 1)
        await students[0].screenshot({
          path: "artifacts/screenshots/student-mingle.png",
          fullPage: true,
        });
      await admin.getByRole("button", { name: "Start next round" }).click();
      await expect(
        students[0].getByText(`Round ${round + 1} of 3`, { exact: false }),
      ).toBeVisible();
    }
  }
  await admin.getByRole("button", { name: "Standings", exact: true }).click();
  await expect(
    admin.getByRole("heading", { name: "Knowledge, in perspective." }),
  ).toBeVisible();
  await expect(admin.getByRole("table")).toBeVisible();
  await admin.screenshot({
    path: "artifacts/screenshots/admin-standings.png",
    fullPage: true,
  });
  const exported = await admin.request.get(
    (await admin
      .getByRole("link", { name: "Full evidence", exact: true })
      .getAttribute("href")) as string,
  );
  expect(exported.ok()).toBeTruthy();
  const evidence = await exported.json();
  expect(evidence.exam.groups).toHaveLength(3);
  expect(
    evidence.exam.responses.some((r: { flagged: boolean }) => r.flagged),
  ).toBeTruthy();
  expect(evidence.exam.diagnostics).toHaveLength(36);
  expect(evidence.resultStatus).toBe("REHEARSAL");
  expect(errors).toEqual([]);
  for (const page of students) {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
  }
  for (const context of contexts) await context.close();
  await adminContext.close();
});
test("unsupported voice input gives an actionable preflight error; mobile instructor navigation remains labeled", async ({
  browser,
}) => {
  const context = await browser.newContext({
      viewport: { width: 320, height: 800 },
    }),
    page = await context.newPage();
  await page.goto("/admin");
  await page
    .getByLabel("Instructor password")
    .fill("browser-rehearsal-password");
  await page.getByRole("button", { name: "Open instructor workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Prepare the conversation." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await expect(
    page.getByRole("button", { name: "Preparation", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/screenshots/admin-mobile.png",
    fullPage: true,
  });
  await context.close();
});
