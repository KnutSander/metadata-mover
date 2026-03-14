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
}

export const DEFAULT_SETTINGS: MetadataMoverSettings = {
	mySetting: '',
	rules: [],
	upProperty: 'up',
	enableUpRule: true,
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

		new Setting(containerEl)
			.setName('Up mapping field')
			.setDesc('Frontmatter property that points to parent note (up link)')
			.addText(text => text
				.setPlaceholder('property (e.g. up)')
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

		containerEl.createEl('h3', { text: 'Property:Value → Folder Mapping' });

		this.plugin.settings.rules.forEach((rule, index) => {
			new Setting(containerEl)
				.addText(text => text
					.setPlaceholder('property')
					.setValue(rule.property)
					.onChange(async (value) => {
						this.plugin.settings.rules[index].property = value.trim();
						await this.plugin.saveSettings();
					}))
				.addText(text => text
					.setPlaceholder('value')
					.setValue(rule.value)
					.onChange(async (value) => {
						this.plugin.settings.rules[index].value = value.trim();
						await this.plugin.saveSettings();
					}))
				.addText(text => text
					.setPlaceholder('folder')
					.setValue(rule.folder)
					.onChange(async (value) => {
						this.plugin.settings.rules[index].folder = value.trim();
						await this.plugin.saveSettings();
					}))
				.addButton(button => button
					.setIcon('arrow-up')
					.setTooltip('Move mapping up')
					.onClick(async () => {
						if (index <= 0) return;
						const rules = this.plugin.settings.rules;
						[rules[index - 1], rules[index]] = [rules[index], rules[index - 1]];
						await this.plugin.saveSettings();
						this.display();
					}))
				.addButton(button => button
					.setIcon('arrow-down')
					.setTooltip('Move mapping down')
					.onClick(async () => {
						const rules = this.plugin.settings.rules;
						if (index >= rules.length - 1) return;
						[rules[index], rules[index + 1]] = [rules[index + 1], rules[index]];
						await this.plugin.saveSettings();
						this.display();
					}))
				.addButton(button => button
					.setIcon('trash')
					.setTooltip('Remove mapping')
					.onClick(async () => {
						this.plugin.settings.rules.splice(index, 1);
						await this.plugin.saveSettings();
						this.display();
					}));
		});

		let newProperty = '';
		let newValue = '';
		let newFolder = '';

		new Setting(containerEl)
			.setName('Add new mapping')
			.setDesc('Configure property:value → folder rules')
			.addText(text => text
				.setPlaceholder('property (e.g. type)')
				.onChange((value) => newProperty = value.trim()))
			.addText(text => text
				.setPlaceholder('value (e.g. project)')
				.onChange((value) => newValue = value.trim()))
			.addText(text => text
				.setPlaceholder('folder (e.g. Projects)')
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
					this.display();
				}));
	}
}
