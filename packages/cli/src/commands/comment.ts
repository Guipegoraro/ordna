import { spawnSync } from "node:child_process";
import { addComment } from "@frehilm/ordna-core";
import { c } from "../colors.js";
import { ensureContextOrExit } from "../lib/ensure-context.js";

/**
 * Author for a new comment: `--as`, then `$ORDNA_AUTHOR`, then
 * `git config user.name`. Null when none of them is set.
 */
function resolveAuthor(explicit: string | undefined): string | null {
	if (explicit && explicit.trim().length > 0) return explicit;
	const fromEnv = process.env.ORDNA_AUTHOR;
	if (fromEnv && fromEnv.trim().length > 0) return fromEnv;
	const git = spawnSync("git", ["config", "user.name"], { encoding: "utf8" });
	const fromGit = git.status === 0 ? git.stdout.trim() : "";
	return fromGit.length > 0 ? fromGit : null;
}

export async function runComment(
	id: string,
	text: string,
	options: { as?: string } = {},
): Promise<void> {
	const ctx = await ensureContextOrExit();
	const author = resolveAuthor(options.as);
	if (!author) {
		console.error(
			c.red("No comment author. Pass --as <name>, set ORDNA_AUTHOR, or set git config user.name."),
		);
		process.exitCode = 1;
		return;
	}
	try {
		const comment = await addComment(id, { author, text }, ctx);
		console.log(
			`${c.bold(id)} ${c.magenta(`@${comment.author}`)} ${c.dim(comment.date)} — ${comment.text}`,
		);
	} catch (error) {
		console.error(c.red((error as Error).message));
		process.exitCode = 1;
	}
}
