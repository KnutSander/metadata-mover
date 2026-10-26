import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import MetadataMover from "./main";

export interface MappingRule {
	property: string;
	value: string;
	folder: string;
}

export interface MetadataMoverSettings {
	mySetting: string;
	rules: MappingRule[];
	upProperty: string;
	enableUpRule: boolean;
	excludeFolders: string[];
}

export const DEFAULT_SETTINGS: MetadataMoverSettings = {
	mySetting: '',
	rules: [],
	upProperty: 'up',
	enableUpRule: true,
	excludeFolders: [],
};

export class MetadataMoverSettingsTab extends PluginSettingTab {
	plugin: MetadataMover;

	constructor(app: App, plugin: MetadataMover) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.addClass('metadata-mover-settings');

		new Setting(containerEl)
			.setName('Up note behavior')
			.setHeading();

		new Setting(containerEl)
			.setName('Up mapping field')
			.setDesc('Frontmatter property that points to parent note (up link)')
			.addText(text => text
				.setPlaceholder('Property such as up')
				.setValue(this.plugin.settings.upProperty)
				.onChange(async (value) => {
					this.plugin.settings.upProperty = value.trim();
					await this.plugin.saveSettings();
				}))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableUpRule)
				.onChange(async (value) => {
					this.plugin.settings.enableUpRule = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Folders to exclude')
			.setHeading();

		new Setting(containerEl)
			.setName('Excluded folders')
			.setDesc('One folder per line (relative to vault). Notes inside these folders are ignored')
			.addTextArea(text => text
				.setPlaceholder('Folder 1\nfolder2/subfolder')
				.setValue((this.plugin.settings.excludeFolders || []).join('\n'))
				.onChange(async (value) => {
					const folders = value
						.split('\n')
						.map(line => line.trim())
						.filter(line => line.length > 0);
					this.plugin.settings.excludeFolders = folders;
					await this.plugin.saveSettings();
				}));


		new Setting(containerEl)
			.setName('Frontmatter rules')
			.setDesc('Separate property names and values with semicolons in the same order. Every condition must match, and the most specific matching rule is used.')
			.setHeading();

		const rules = this.plugin.settings.rules || [];
		if (rules.length === 0) {
			containerEl.createEl('p', {
				text: 'No rules yet. Add a rule below to move notes based on their frontmatter.',
				cls: 'metadata-mover-empty-state',
			});
		}

		rules.forEach((rule, index) => {
			const setting = new Setting(containerEl)
				.setName(`Mapping ${index + 1}`)
				.setDesc(`Move to ${rule.folder || 'no destination set'} when all conditions match.`);
			setting.settingEl.addClass('metadata-mover-rule');

			setting
				.addText(text => text
					.setPlaceholder('Property or properties')
					.setValue(rule.property)
					.onChange(async (value) => {
						const ruleToUpdate = this.plugin.settings.rules[index];
						if (!ruleToUpdate) return;
						ruleToUpdate.property = value.trim();
						await this.plugin.saveSettings();
					}))
				.addText(text => text
					.setPlaceholder('Value or values')
					.setValue(rule.value)
					.onChange(async (value) => {
						const ruleToUpdate = this.plugin.settings.rules[index];
						if (!ruleToUpdate) return;
						ruleToUpdate.value = value.trim();
						await this.plugin.saveSettings();
					}))
				.addText(text => text
					.setPlaceholder('Destination folder')
					.setValue(rule.folder)
					.onChange(async (value) => {
						const ruleToUpdate = this.plugin.settings.rules[index];
						if (!ruleToUpdate) return;
						ruleToUpdate.folder = value.trim();
						await this.plugin.saveSettings();
					}))
				.addButton(button => button
					.setIcon('arrow-up')
					.setTooltip('Move mapping up')
					.onClick(async () => {
						if (index <= 0) return;
						const rules = this.plugin.settings.rules;
						const a = rules[index - 1];
						const b = rules[index];
						if (!a || !b) return;
						rules[index - 1] = b;
						rules[index] = a;
						await this.plugin.saveSettings();
						this.refreshSettingsDisplay();
					}))
				.addButton(button => button
					.setIcon('arrow-down')
					.setTooltip('Move mapping down')
					.onClick(async () => {
						const rules = this.plugin.settings.rules;
						if (index >= rules.length - 1) return;
						const a = rules[index];
						const b = rules[index + 1];
						if (!a || !b) return;
						rules[index] = b;
						rules[index + 1] = a;
						await this.plugin.saveSettings();
						this.refreshSettingsDisplay();
					}))
				.addButton(button => button
					.setIcon('trash')
					.setTooltip('Remove mapping')
					.onClick(async () => {
						this.plugin.settings.rules.splice(index, 1);
						await this.plugin.saveSettings();
						this.refreshSettingsDisplay();
					}));
		});

		let newProperty = '';
		let newValue = '';
		let newFolder = '';

		new Setting(containerEl)
			.setName('Add new mapping')
			.setDesc('For multiple conditions, separate properties and values with semicolons in matching order. Example: type;status and project;archived.')
			.addText(text => text
				.setPlaceholder('Property (type;status)')
				.onChange((value) => newProperty = value.trim()))
			.addText(text => text
				.setPlaceholder('Value (project;archived)')
				.onChange((value) => newValue = value.trim()))
			.addText(text => text
				.setPlaceholder('Destination folder')
				.onChange((value) => newFolder = value.trim()))
			.addButton(button => button
				.setIcon('plus')
				.setTooltip('Add mapping')
				.onClick(async () => {
					if (!newProperty || !newValue || !newFolder) {
						new Notice('Property, value, and folder are required.');
						return;
					}

					this.plugin.settings.rules.push({ property: newProperty, value: newValue, folder: newFolder });
					await this.plugin.saveSettings();
					this.refreshSettingsDisplay();
				}));
	}

	private refreshSettingsDisplay(): void {
		// Keep using display() for compatibility with the declared minimum app version.
		// eslint-disable-next-line @typescript-eslint/no-deprecated
		this.display();
	}
}
