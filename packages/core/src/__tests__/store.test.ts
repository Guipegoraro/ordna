import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createContext } from "../store.js";
import { addComment, createTask, moveTask, updateTask, listTasks, getTask } from "../store.js";
import { extractComments, splitSections } from "../parser.js";
import { makeTempRepo } from "./helpers.js";

describe("store — ordna mode", () => {
	it("creates tasks with T-001 style IDs and lists them", async () => {
		const repo = makeTempRepo("ordna");
		const ctx = createContext(repo.cwd);

		const a = await createTask({ title: "First" }, ctx);
		const b = await createTask({ title: "Second" }, ctx);

		expect(a.id).toBe("T-001");
		expect(b.id).toBe("T-002");
		expect(a.status).toBe("todo");
		expect(a.filePath.endsWith("T-001.md")).toBe(true);

		const all = await listTasks(ctx);
		expect(all.map((t) => t.id)).toEqual(["T-001", "T-002"]);
	});

	it("move to done is blocked when depends_on has unfinished tasks", async () => {
		const repo = makeTempRepo("ordna");
		const ctx = createContext(repo.cwd);

		const dep = await createTask({ title: "Dep" }, ctx);
		const blocked = await createTask({ title: "Blocked", depends_on: [dep.id] }, ctx);

		await expect(moveTask(blocked.id, "done", ctx)).rejects.toThrow(/dependencies not done/);

		await moveTask(dep.id, "done", ctx);
		const moved = await moveTask(blocked.id, "done", ctx);
		expect(moved.status).toBe("done");
	});

	it("rejects unknown statuses", async () => {
		const repo = makeTempRepo("ordna");
		const ctx = createContext(repo.cwd);
		const t = await createTask({ title: "x" }, ctx);
		await expect(updateTask(t.id, { status: "nonsense" }, ctx)).rejects.toThrow(/not in configured/);
	});

	it("updates bump updated_at", async () => {
		const repo = makeTempRepo("ordna");
		const ctx = createContext(repo.cwd);
		const t = await createTask({ title: "x" }, ctx);
		const updated = await updateTask(t.id, { title: "y" }, ctx);
		const today = new Date().toISOString().slice(0, 10);
		expect(updated.updated_at).toBe(today);
		expect(updated.title).toBe("y");
	});
});

describe("store — comments", () => {
	it("creates ## Comments lazily and appends one line per comment", async () => {
		const repo = makeTempRepo("ordna");
		const ctx = createContext(repo.cwd);
		const t = await createTask({ title: "x" }, ctx);
		expect(readFileSync(t.filePath, "utf8")).not.toContain("## Comments");

		const first = await addComment(
			t.id,
			{ author: "@fredrik", text: "watch the\npaging param" },
			ctx,
		);
		await addComment(t.id, { author: "agent", text: "noted" }, ctx);
		const today = new Date().toISOString().slice(0, 10);
		expect(first).toEqual({ author: "fredrik", date: today, text: "watch the paging param" });

		const reloaded = await getTask(t.id, ctx);
		expect(reloaded?.sections.map((s) => s.heading)).toEqual([
			"Goal",
			"Acceptance Criteria",
			"Notes",
			"Progress",
			"Comments",
		]);
		expect(extractComments(reloaded?.sections ?? [])).toEqual([
			{ author: "fredrik", date: today, text: "watch the paging param" },
			{ author: "agent", date: today, text: "noted" },
		]);
	});

	it("appends to an existing Comments section wherever it sits", async () => {
		const repo = makeTempRepo("ordna");
		const ctx = createContext(repo.cwd);
		const t = await createTask({ title: "x" }, ctx);
		await updateTask(
			t.id,
			{
				sections: splitSections("## Comments\n- **@a** _2026-08-01_ — first\n\n## Notes\nkeep me"),
			},
			ctx,
		);
		await addComment(t.id, { author: "b", text: "second" }, ctx);
		const reloaded = await getTask(t.id, ctx);
		expect(reloaded?.sections.map((s) => s.heading)).toEqual(["Comments", "Notes"]);
		expect(extractComments(reloaded?.sections ?? []).map((c) => c.text)).toEqual([
			"first",
			"second",
		]);
		expect(reloaded?.sections[1]?.content).toBe("keep me");
	});

	it("keeps the author on one line so it can't inject a heading", async () => {
		const repo = makeTempRepo("ordna");
		const ctx = createContext(repo.cwd);
		const t = await createTask({ title: "x" }, ctx);
		const comment = await addComment(t.id, { author: "@ bob\n## Notes", text: "hi" }, ctx);
		expect(comment.author).toBe("bob ## Notes");

		const reloaded = await getTask(t.id, ctx);
		expect(reloaded?.sections.filter((s) => s.heading === "Notes")).toHaveLength(1);
		expect(extractComments(reloaded?.sections ?? [])).toEqual([comment]);

		await expect(
			addComment(t.id, { author: "x** _2020-01-01_ — spoof", text: "hi" }, ctx),
		).rejects.toThrow(/can't contain/);
	});

	it("rejects empty text, empty author and unknown tasks", async () => {
		const repo = makeTempRepo("ordna");
		const ctx = createContext(repo.cwd);
		const t = await createTask({ title: "x" }, ctx);
		await expect(addComment(t.id, { author: "a", text: "  " }, ctx)).rejects.toThrow(
			/text is empty/,
		);
		await expect(addComment(t.id, { author: "@", text: "hi" }, ctx)).rejects.toThrow(
			/author is empty/,
		);
		await expect(addComment("T-999", { author: "a", text: "hi" }, ctx)).rejects.toThrow(
			/not found/,
		);
	});
});

describe("store — backlog mode file naming", () => {
	it("writes task-N - slug.md files", async () => {
		const repo = makeTempRepo("backlog");
		const ctx = createContext(repo.cwd);
		const t = await createTask({ title: "Add Search Endpoint" }, ctx);
		expect(t.id).toBe("T-001");
		expect(t.filePath).toMatch(/task-1 - add-search-endpoint\.md$/);
		const content = readFileSync(t.filePath, "utf8");
		expect(content).toContain("labels:");
		expect(content).toContain("dependencies:");
	});
});

describe("store — defaults without config", () => {
	it("uses tasks/ and T-### with no .ordna/config.yaml", async () => {
		const { mkdtempSync } = await import("node:fs");
		const { tmpdir } = await import("node:os");
		const cwd = mkdtempSync(join(tmpdir(), "ordna-defaults-"));
		const ctx = createContext(cwd);

		const t = await createTask({ title: "Default test" }, ctx);
		expect(t.id).toBe("T-001");
		expect(t.filePath.endsWith(join("tasks", "T-001.md"))).toBe(true);
		expect(t.status).toBe("todo");

		const fetched = await getTask("T-001", ctx);
		expect(fetched?.title).toBe("Default test");
	});
});
