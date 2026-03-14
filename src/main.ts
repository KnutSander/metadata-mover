import { MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { DEFAULT_SETTINGS, MetadataMoverSettings, MetadataMoverSettingsTab } from "./settings";

// Remember to rename these classes and interfaces!

export default class MetadataMover extends Plugin {
	settings: MetadataMoverSettings;
	private frontmatterHashes: Map<string, string> = new Map();

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "move-note-by-frontmatter",
			name: "Move note by frontmatter property",
			checkCallback: (checking: boolean) => {
				const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!mdView || !mdView.file) return false;
				if (!checking) void this.moveFileByFrontmatter(mdView.file);
				return true;
			},
		});

		this.registerEvent(this.app.vault.on('modify', (file) => {
			if (!(file instanceof TFile) || file.extension !== 'md') return;

			setTimeout(async () => {
				const cached = this.app.metadataCache.getFileCache(file);
				const fm = cached?.frontmatter;
				if (!fm) return;

				const currentHash = JSON.stringify(fm);
				const previousHash = this.frontmatterHashes.get(file.path);
				if (currentHash === previousHash) return;

				this.frontmatterHashes.set(file.path, currentHash);
				await this.moveFileByFrontmatter(file, fm);
			}, 50);
		}));

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

	async moveFileByFrontmatter(file: TFile, frontmatter?: Record<string, any>) {
		let fm = frontmatter;
		if (!fm) {
			const cached = this.app.metadataCache.getFileCache(file);
			fm = cached?.frontmatter;
		}
		if (!fm) {
			new Notice("No frontmatter found.");
			return;
		}

		const currentFolder = file.parent?.path ?? "";

		if (this.settings.enableUpRule) {
			const upField = this.settings.upProperty;
			const upVal = fm[upField];
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
		}

		// 3) mapping rules from user-configured settings
		const ruleMatch = (this.settings.rules || []).find(rule => {
			const value = String(fm[rule.property] ?? "").trim().toLowerCase();
			return value === String(rule.value ?? "").trim().toLowerCase();
		});

		if (ruleMatch) {
			await this.ensureAndMove(file, ruleMatch.folder);
			return;
		}

		new Notice("No mapping rule matched; no action taken.");
	}

	private resolveUpFile(upValue: string, currentFilePath: string): TFile | null {
		// In this vault, `up` is always a plain wiki link like [[(Project) - Foo]]
		const match = String(upValue).trim().match(/^\[\[([^\]]+)\]\]$/);
		if (!match) {
			return null;
		}

		const target = (match[1] ?? '').trim();
		if (!target) {
			return null;
		}
		const resolved = this.app.metadataCache.getFirstLinkpathDest(target, currentFilePath);
		return resolved instanceof TFile ? resolved : null;
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
