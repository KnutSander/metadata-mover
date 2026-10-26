import { App, Modal, PluginSettingTab, Setting, TextComponent } from "obsidian";
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

interface RuleCondition {
	property: string;
	value: string;
}

class MappingRuleModal extends Modal {
	private readonly conditions: RuleCondition[];
	private destination = '';
	private conditionContainer!: HTMLElement;
	private errorEl!: HTMLElement;

	constructor(
		app: App,
		rule: MappingRule | undefined,
		private readonly isEditing: boolean,
		private readonly onSave: (rule: MappingRule) => Promise<void>,
	) {
		super(app);
		const properties = rule?.property.split(';') ?? [''];
		const values = rule?.value.split(';') ?? [''];
		const conditionCount = Math.max(properties.length, values.length, 1);
		this.conditions = Array.from({ length: conditionCount }, (_, index) => ({
			property: properties[index]?.trim() ?? '',
			value: values[index]?.trim() ?? '',
		}));
		this.destination = rule?.folder ?? '';
	}

	onOpen(): void {
		this.setTitle(this.isEditing ? 'Edit mapping rule' : 'Add mapping rule');
		this.contentEl.empty();
		this.contentEl.addClass('metadata-mover-rule-modal');

		new Setting(this.contentEl)
			.setName('Conditions')
			.setDesc('Every condition must match. Add a property and value for each one.')
			.setHeading();

		this.conditionContainer = this.contentEl.createDiv({ cls: 'metadata-mover-condition-list' });
		this.errorEl = this.contentEl.createDiv({ cls: 'metadata-mover-form-error' });
		this.renderConditions();

		new Setting(this.contentEl)
			.setName('Destination folder')
			.addText(text => text
				.setPlaceholder('Folder path')
				.setValue(this.destination)
				.onChange(value => {
					this.destination = value.trim();
				}));

		this.errorEl.setAttr('role', 'alert');

		new Setting(this.contentEl)
			.addButton(button => button
				.setButtonText('Add condition')
				.setTooltip('Add another property and value condition')
				.onClick(() => {
					this.conditions.push({ property: '', value: '' });
					this.renderConditions();
				}))
			.addButton(button => button
				.setButtonText('Cancel')
				.onClick(() => this.close()))
			.addButton(button => button
				.setButtonText('Save rule')
				.setCta()
				.onClick(() => {
					void this.saveRule();
				}));
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderConditions(): void {
		this.conditionContainer.empty();
		this.conditions.forEach((condition, index) => {
			const setting = new Setting(this.conditionContainer)
				.setName(`Condition ${index + 1}`);
			setting.settingEl.addClass('metadata-mover-condition');
			setting
				.addText(text => this.configureConditionInput(text, condition.property, 'Property', value => {
					condition.property = value;
				}))
				.addText(text => this.configureConditionInput(text, condition.value, 'Value', value => {
					condition.value = value;
				}))
				.addButton(button => button
					.setIcon('trash')
					.setTooltip(`Remove condition ${index + 1}`)
					.onClick(() => {
						this.conditions.splice(index, 1);
						this.renderConditions();
					}));
		});
	}

	private configureConditionInput(
		text: TextComponent,
		value: string,
		placeholder: string,
		onChange: (value: string) => void,
	): TextComponent {
		return text
			.setPlaceholder(placeholder)
			.setValue(value)
			.onChange(onChange);
	}

	private async saveRule(): Promise<void> {
		const conditions = this.conditions
			.map(condition => ({
				property: condition.property.trim(),
				value: condition.value.trim(),
			}))
			.filter(condition => condition.property.length > 0 || condition.value.length > 0);

		if (conditions.length === 0) {
			this.showError('Add at least one property and value condition.');
			return;
		}

		if (conditions.some(condition => !condition.property || !condition.value)) {
			this.showError('Each condition needs both a property and a value.');
			return;
		}

		if (!this.destination) {
			this.showError('Enter a destination folder.');
			return;
		}

		try {
			await this.onSave({
				property: conditions.map(condition => condition.property).join(';'),
				value: conditions.map(condition => condition.value).join(';'),
				folder: this.destination,
			});
			this.close();
		} catch (error) {
			console.error('Failed to save mapping rule.', error);
			this.showError('Could not save the rule. Check the console for details and try again.');
		}
	}

	private showError(message: string): void {
		this.errorEl.setText(message);
	}
}

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
			.setDesc('Every condition in a rule must match. The most specific matching rule is used; move equally specific rules higher to give them priority.')
			.setHeading();

		const rules = this.plugin.settings.rules || [];
		if (rules.length === 0) {
			containerEl.createEl('p', {
				text: 'No rules yet. Add a rule below to move notes based on their frontmatter.',
				cls: 'metadata-mover-empty-state',
			});
		}

		rules.forEach((rule, index) => {
			const conditionCount = Math.max(rule.property.split(';').length, rule.value.split(';').length);
			const setting = new Setting(containerEl)
				.setName(`${index + 1}. ${this.formatConditions(rule)}`)
				.setDesc(`${conditionCount} ${conditionCount === 1 ? 'condition' : 'conditions'} → ${rule.folder || 'No destination set'}`);
			setting.settingEl.addClass('metadata-mover-rule-summary');

			setting
				.addButton(button => button
					.setIcon('pencil')
					.setTooltip('Edit mapping rule')
					.onClick(() => this.openRuleModal(index)))
				.addButton(button => button
					.setIcon('copy')
					.setTooltip('Duplicate mapping rule')
					.onClick(() => this.openRuleModal(undefined, rule)))
				.addButton(button => button
					.setIcon('arrow-up')
					.setTooltip('Move mapping up')
					.setDisabled(index === 0)
					.onClick(() => {
						void this.moveRule(index, -1);
					}))
				.addButton(button => button
					.setIcon('arrow-down')
					.setTooltip('Move mapping down')
					.setDisabled(index === rules.length - 1)
					.onClick(() => {
						void this.moveRule(index, 1);
					}))
				.addButton(button => button
					.setIcon('trash')
					.setTooltip('Remove mapping')
					.onClick(() => {
						void this.removeRule(index);
					}));
		});

		new Setting(containerEl)
			.setName('Add mapping rule')
			.setDesc('Create a rule with one or more property/value conditions.')
			.addButton(button => button
				.setButtonText('Add rule')
				.setCta()
				.onClick(() => this.openRuleModal()));
	}

	private formatConditions(rule: MappingRule): string {
		const properties = rule.property.split(';');
		const values = rule.value.split(';');
		const conditionCount = Math.max(properties.length, values.length);
		return Array.from({ length: conditionCount }, (_, index) => {
			const property = properties[index]?.trim() || '?';
			const value = values[index]?.trim() || '?';
			return `${property} = ${value}`;
		})
			.join(' AND ');
	}

	private openRuleModal(index?: number, duplicateRule?: MappingRule): void {
		const rule = index === undefined ? duplicateRule : this.plugin.settings.rules[index];
		if (index !== undefined && !rule) return;

		new MappingRuleModal(this.app, rule, index !== undefined, async updatedRule => {
			if (index === undefined) {
				this.plugin.settings.rules.push(updatedRule);
			} else {
				this.plugin.settings.rules[index] = updatedRule;
			}
			await this.plugin.saveSettings();
			this.refreshSettingsDisplay();
		}).open();
	}

	private async moveRule(index: number, offset: -1 | 1): Promise<void> {
		const rules = this.plugin.settings.rules;
		const targetIndex = index + offset;
		if (targetIndex < 0 || targetIndex >= rules.length) return;

		const rule = rules[index];
		const targetRule = rules[targetIndex];
		if (!rule || !targetRule) return;

		rules[index] = targetRule;
		rules[targetIndex] = rule;
		await this.plugin.saveSettings();
		this.refreshSettingsDisplay();
	}

	private async removeRule(index: number): Promise<void> {
		this.plugin.settings.rules.splice(index, 1);
		await this.plugin.saveSettings();
		this.refreshSettingsDisplay();
	}

	private refreshSettingsDisplay(): void {
		// Keep using display() for compatibility with the declared minimum app version.
		// eslint-disable-next-line @typescript-eslint/no-deprecated
		this.display();
	}
}
