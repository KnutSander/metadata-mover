import { App, Editor, MarkdownView, Modal, Notice, Plugin, TFile } from 'obsidian';
import { DEFAULT_SETTINGS, MetadataMoverSettings, MetadataMoverSettingsTab } from "./settings";

// Remember to rename these classes and interfaces!

export default class MetadataMover extends Plugin {
	settings: MetadataMoverSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "move-note-by-frontmatter",
			name: "Move note by frontmatter property",
			checkCallback: (checking: boolean) => {
				const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!mdView || !mdView.file) return false;
				if (!checking) void this.moveActiveFileByFrontmatter(mdView);
				return true;
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new MetadataMoverSettingsTab(this.app, this));

	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<MetadataMoverSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async moveActiveFileByFrontmatter(view: MarkdownView) {
		const file = view.file;
		if (!file) {
			new Notice("No active file to move.");
			return;
		}
		const cached = this.app.metadataCache.getFileCache(file);
		const frontmatter = cached?.frontmatter;
		if (!frontmatter) {
			new Notice("No frontmatter found.");
			return;
		}

		// 1) completed status -> Archive
		const status = String(frontmatter.status ?? "").trim().toLowerCase();
		if (status === "completed") {
			await this.ensureAndMove(file, "Archives"); 
			return;
		}

		const currentFolder = file.parent?.path ?? "";

		// 2) if `up` points to a file, move this note to `up` file folder
		const upVal = frontmatter.up;
		if (typeof upVal === "string" && upVal.trim().length > 0) {
			const upFile = this.resolveUpFile(upVal, file.path);
			if (upFile) {
				const upFolder = upFile.parent?.path;
				if (upFolder) {
					if (upFolder === currentFolder) {
						new Notice("Note is already in the same folder as its 'up' note.");
						return;
					}
					await this.ensureAndMove(file, upFolder);
					return;
				}
			}
		}

		// 3) type mapping
		const typeVal = String(frontmatter.type ?? "").trim().toLowerCase();
		let targetDir = "";
		if (typeVal === "project") {
			targetDir = "Projects";
		} else if (typeVal === "area") {
			targetDir = "Areas";
		} else if (typeVal === "resource") {
			targetDir = "Resources";
		} else {
			new Notice("No move rule matched (status not completed, not same up-folder, type not project/area/resource).\nNo action taken.");
			return;
		}

		await this.ensureAndMove(file, targetDir);
	}

	private resolveUpFile(upValue: string, currentFilePath: string): TFile | null {
		let link = upValue.trim();

		// up is always a wiki link: [[Some Note]] or [[some/path|alias]]
		const wikiMatch = link.match(/^\s*\[\[([^\]]+)\]\]\s*$/);
		if (!wikiMatch) {
			return null;
		}
		link = wikiMatch[1];

		// alias: `Some Note|text` -> Some Note
		if (link.includes("|")) {
			link = link.split("|")[0].trim();
		}

		const resolved = this.app.metadataCache.getFirstLinkpathDest(link, currentFilePath);
		if (resolved instanceof TFile) {
			return resolved;
		}

		return null;
	}

	private async ensureAndMove(file: TFile, targetDir: string) {
		const targetPath = `${targetDir}/${file.name}`;
		if (file.path === targetPath) {
			new Notice("Already in target folder; no move needed.");
			return;
		}

		if (!this.app.vault.getAbstractFileByPath(targetDir)) {
			await this.app.vault.createFolder(targetDir);
		}

		try {
			await this.app.vault.rename(file, targetPath);
			new Notice(`Moved to ${targetPath}`);
		} catch (error) {
			console.error(error);
			new Notice(`Move failed: ${error}`);
		}
	}
}
