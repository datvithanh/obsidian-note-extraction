import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, getAllTags, Setting, TFile } from 'obsidian';
import { copyFile, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { readdirSync, unlinkSync } from 'fs';
// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	tag: string;
	noteFolder: string;
	attachmentFolder: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	tag: '#publish',
	noteFolder: '/Users/datvithanh/Project/datvt/content',
	attachmentFolder: '/Users/datvithanh/Project/datvt/content/attachments'
}

function compareFiles(file1Path: string, file2Path: string) {
	const file1Content = readFileSync(file1Path, 'utf-8');
	const file2Content = readFileSync(file2Path, 'utf-8');
  
	return file1Content === file2Content;
}

function extractTitle(s: string){
	var titleRegex = /title:\s*(.*?)\n/;
	var match = titleRegex.exec(s);
	if (match && match.length > 1) {
		return match[1]
	}

	return ""
}

export default class NotesExtractionPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();
		const basePath = (this.app.vault.adapter as any).basePath;
		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('crossed-star', 'Publish notes', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			const notes: TFile[] = this.app.vault.getMarkdownFiles();
			for (const noteFile of notes) {
				const fileCachedData = this.app.metadataCache.getFileCache(noteFile) || {};

				if (noteFile.path.startsWith('publish/')) {
					// read the file, remove publish tag, and write back to the new path
					(async () => {
						const content = await this.app.vault.read(noteFile);
						var newContent = content.replace('#publish\n', '');
						var title = extractTitle(newContent)
						if (title != noteFile.name && noteFile.name != "index.md") {
							newContent = newContent.replace(/title:\s*(.*?)\n/, `title: ${noteFile.name.replace(".md", "")}\n`)
						}
						await this.app.vault.modify(noteFile, newContent);
					}) ()

					const filePath = join(basePath, noteFile.path);
					const newFilePath = join(this.settings.noteFolder, noteFile.name);

					if (existsSync(newFilePath)) {
						if (compareFiles(filePath, newFilePath)) {
							console.log (noteFile.name, 'is the same, skip');
							continue;
						}
					}

					// copy the file to a different os path
					copyFile(filePath, newFilePath, (err) => {
						if (err) throw err;
						console.log(noteFile.name, 'copied to destination.txt');
					});
					
					// copy all of the attachment to a different os path
					const embeds = fileCachedData.embeds ?? [];
					console.log(basePath);
					for (const embed of embeds) {
						copyFile(join(basePath, "_meta/_files", embed.link), join(this.settings.attachmentFolder, embed.link), (err) => {
							if (err) throw err;
							console.log('file copied to destination.txt');
						});
					}
				}
			}
	
			new Notice('Move files done!');

			// find refundant files in publish and remove them

			const noteFiles = notes.filter(noteFile => noteFile.path.startsWith('publish/'))
			const noteFilesNames = noteFiles.map(noteFile => noteFile.path.replace("publish/", ""));
			const publishFiles = readdirSync(this.settings.noteFolder);

			const filesToCleanUp = publishFiles.filter(file => !noteFilesNames.includes(file) && file.endsWith(".md"));
			console.log("Cleaning up files:", filesToCleanUp)
			filesToCleanUp.forEach(file => {
				const filePath = join(this.settings.noteFolder, file);
				unlinkSync(filePath);
				console.log(`${file} deleted from publishFolder`);
			});
		});

		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new NotesExtractionPlugginSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class NotesExtractionPlugginSettingTab extends PluginSettingTab {
	plugin: NotesExtractionPlugin;

	constructor(app: App, plugin: NotesExtractionPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Note extraction setting')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Tag to copy to')
				.setValue(this.plugin.settings.tag)
				.onChange(async (value) => {
					this.plugin.settings.tag = value;
					await this.plugin.saveSettings();
				}))
			.addText(text => text
				.setPlaceholder('Note folder')
				.setValue(this.plugin.settings.noteFolder)
				.onChange(async (value) => {
					this.plugin.settings.noteFolder = value;
					await this.plugin.saveSettings();
				}))
			.addText(text => text
				.setPlaceholder('Attachment folder')
				.setValue(this.plugin.settings.attachmentFolder)
				.onChange(async (value) => {
					this.plugin.settings.attachmentFolder = value;
					await this.plugin.saveSettings();
				}));
	}
}
