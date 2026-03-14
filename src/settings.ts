import {App, PluginSettingTab, Setting, Notice} from "obsidian";
import MetadataMover from "./main";

export interface MappingRule {
	property: string;
	value: string;
	folder: string;
}

export interface MetadataMoverSettings {
	mySetting: string;
	rules: MappingRule[];
}

export const DEFAULT_SETTINGS: MetadataMoverSettings = {
	mySetting: '',
	rules: [],
};

export class MetadataMoverSettingsTab extends PluginSettingTab {
	plugin: MetadataMover;

	constructor(app: App, plugin: MetadataMover) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h3', { text: 'Field:value → Folder Mapping' });

		this.plugin.settings.rules.forEach((rule, index) => {
			new Setting(containerEl)
				.setName(`${rule.property}:${rule.value}`)
				.setDesc(`Move when ${rule.property} = ${rule.value}`)
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
				.setPlaceholder('property (e.g. type, category)')
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
