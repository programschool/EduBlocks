import React = require('preact');
import { Component } from 'preact';
import { getPlatform, getPlatformList } from '../platforms';
import { App, Capability, Extension, Platform, PlatformInterface } from '../types';
import * as firebase from 'firebase/app';
import { AuthModal } from './Auth';
import AlertModal from './AlertModal';
import UploadModal from './UploadModal';
import BlocklyView from './BlocklyView';
import ImageModal from './ImageModal';
import Nav from './Nav';

import OverModal from './OverwriteModal';
import PythonView from './PythonView';
import RemoteShellView from './RemoteShellView';
import SelectModal, { SelectModalOption } from './SelectModal';
import FirebaseSelectModal from './FirebaseSelectModal';

import TrinketView from './TrinketView';

type AdvancedFunction = 'Export Python' | 'Themes' | 'Flash Hex' | 'Extensions' | 'Split View' | 'Switch Language';
let AdvancedFunctions: AdvancedFunction[] = ['Export Python', 'Themes', "Split View", "Switch Language"];

type Languages = 'English' | 'French';
const Languages: Languages[] = ['English', 'French'];

const ViewModeBlockly = 'blocks';
const ViewModePython = 'python';

type ViewMode = typeof ViewModeBlockly | typeof ViewModePython;

interface Props {
    app: App;
}

interface DocumentState {
    xml: string | null;
    python: string | null;
    pythonClean: boolean;
}

interface FileFirebaseSelectModalOption {
    label: string;
    ref: firebase.storage.Reference;
}

interface State {
    platform?: PlatformInterface;
    viewMode: ViewMode;
    modal: null | 'platform' | 'terminal' | 'languages' | 'samples' | 'themes' | 'extensions' | 'functions' | 'pythonOverwritten' | 'https' | 'noCode' | 'codeOverwrite' | 'progress' | 'auth' | 'error' | 'files';
    prevModal: null | 'platform' | 'terminal' | 'languages' | 'samples' | 'themes' | 'extensions' | 'functions' | 'pythonOverwritten' | 'https' | 'noCode' | 'codeOverwrite' | 'progress' | 'auth' | 'error' | 'files';
    extensionsActive: Extension[];
    progress: number;
    doc: Readonly<DocumentState>;
    fileName: string;
    files: FileFirebaseSelectModalOption[];
}

// Labels

export let navLabels: string[] = new Array();
navLabels = ["New", "Open", "Save", "Samples", "Extras", "Run", "Login", "Untitled", "Download Hex", "Download", "Themes"];

export let generic: string[] = new Array();
generic = ["Open", 
            "Go", 
            "Select", 
            "Close", 
            "Delete", 
            "Yes", 
            "No", 
            "Attention!", 
            "There is no code to run!", 
            "Changing mode will make you lose your code, do you wish to continue?", 
            "Uploading...", 
            "Select your mode",
            "Files"];

export default class Page extends Component<Props, State> {
    public remoteShellView?: RemoteShellView;

    constructor() {
        super();

        this.state = {
            viewMode: ViewModeBlockly,
            modal: 'platform',
            prevModal: null,
            extensionsActive: [],
            progress: 0,
            fileName: 'Untitled',
            files: [],
            doc: {
                xml: null,
                python: null,
                pythonClean: true,
            },
        };
    }

    private readBlocklyContents(xml: string) {
        if (this.state.doc.xml === xml) {
            return;
        }

        const doc: DocumentState = {
            xml,
            python: null,
            pythonClean: true,
        };

        this.setState({ doc });

        this.switchView(ViewModeBlockly);
    }

    private updateFromBlockly(xml: string, python: string) {
        if (
            this.state.doc.xml === xml &&
            this.state.doc.python === python
        ) {
            return;
        }

        if (this.state.doc.python !== python && !this.state.doc.pythonClean) {
            this.setState({ modal: 'pythonOverwritten' });
        }

        const doc: DocumentState = {
            xml,
            python,
            pythonClean: true,
        };

        this.setState({ doc });
    }

    private updateFromPython(python: string) {
        if (this.state.doc.python === python) {
            return;
        }

        const doc: DocumentState = {
            xml: this.state.doc.xml,
            python,
            pythonClean: false,
        };

        this.setState({ doc });
    }

    private new() {
        const doc: DocumentState = {
            xml: null,
            python: null,
            pythonClean: true,
        };

        this.setState({ doc });

        this.switchView('blocks');
    }

    public componentDidMount() {
        if (window.location.hash) {
            const platformKey = window.location.hash.slice(1) as unknown as Platform;

            this.selectPlatform(platformKey);
        }
    }

    private toggleView(): 0 {
        switch (this.state.viewMode) {
            case ViewModeBlockly:
                return this.switchView(ViewModePython);

            case ViewModePython:
                return this.switchView(ViewModeBlockly);
        }
    }

    private switchView(viewMode: ViewMode): 0 {
        switch (viewMode) {
            case ViewModeBlockly:
                this.setState({ viewMode: 'blocks' });

                return 0;

            case ViewModePython:
                this.setState({ viewMode: 'python' });

                return 0;
        }
    }

    private openTerminal() {
        if (!this.state.doc.python) {
            this.setState({ modal: 'noCode' });

            return;
        }

        this.setState({ modal: 'terminal' });

        if (this.remoteShellView) {
            this.remoteShellView.focus();
            this.remoteShellView.reset();

            this.props.app.runCode(this.state.doc.python);

            setTimeout(() => this.remoteShellView!.focus(), 250);
        }
    }

    private onBlocklyChange(xml: string, python: string) {
        this.updateFromBlockly(xml, python);
    }

    private onPythonChange(python: string) {
        this.updateFromPython(python);
    }

    private async openFile() {
        const user = firebase.auth().currentUser;
        if (user) {
            let self = this;
            const ref = firebase.storage().ref(`blocks/${user.uid}`);

            ref.listAll().then(function (res) {
                self.setState({
                    files: res.items.map((i) => ({
                        label: i.name,
                        ref: i,
                    })),
                    modal: 'files',
                });
            }).catch(function (error) {
                self.setState({
                    modal: 'error',
                });
                console.error(error);
            });

        } else {
            const xml = await this.props.app.openFile();
            this.readBlocklyContents(xml);
        }
    }

    private async openFirebaseFile(file: firebase.storage.Reference) {
        this.closeModal();
        let self = this;
        file.getDownloadURL().then(function (url) {
            const xhr = new XMLHttpRequest();
            xhr.responseType = 'text';
            xhr.onload = function (event) {
                self.readBlocklyContents(xhr.responseText);
            };
            xhr.open('GET', url);
            xhr.send();
        }).catch(function (error) {
            self.setState({
                modal: 'error',
            });
            console.error(error);
        });

    }

    private async deleteFirebaseFile(file: firebase.storage.Reference) {
        file.delete();
        this.closeModal();
    }

    private async saveFile() {
        const xml = this.state.doc.xml;

        if (xml) {
            const user = firebase.auth().currentUser;

            if (user) {
                let self = this;
                this.setState({
                    modal: 'progress',
                });
                const ref = firebase.storage().ref(`blocks/${user.uid}/${this.state.fileName}.xml`);
                const task = ref.putString(xml, undefined, {
                    contentType: 'text/xml',
                });
                task.on('state_changed', function (snapshot) {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes);
                    self.setState({
                        progress: progress,
                    });
                }, function (error) {
                    self.setState({
                        modal: 'error',
                    });
                    console.error(error);
                }, function () {
                    self.closeModal();
                });
            } else {
                await this.props.app.saveFile(this.state.fileName, xml, 'xml', 'text/xml;charset=utf-8');
            }
        }
    }

    private async downloadPython() {
        const python = this.state.doc.python;

        if (python) {
            await this.props.app.exportPython(this.state.fileName, python, this.state.extensionsActive);
        }
    }

    private async downloadHex() {
        const python = this.state.doc.python;

        if (python) {
            await this.props.app.saveHex(this.state.fileName, python, this.state.extensionsActive);
        }
    }

    private async selectPlatform(platformKey: Platform) {
        const platform = await getPlatform(platformKey);

        if (platformKey === 'Python') {
            this.new();
        }

        if (platformKey === 'RaspberryPi') {
            this.new();
            let ip: string | null = null;

            if (window.location.protocol === 'https:') {
                alert('Need to switch to HTTP to access Raspberry Pi mode...');
                window.location.protocol = 'http:';
                return;
            }

            if (navigator.platform.indexOf('arm') !== -1) {
                await this.props.app.initConnection('localhost');
            } else {
                ip = prompt('Please enter your Raspberry Pi\'s IP address');

                if (!ip) return;

                try {
                    await this.props.app.initConnection(ip);
                } catch (err) {
                    console.error(err);
                }
            }
        }

        this.setState({
            platform,
            modal: null,
            extensionsActive: platform.defaultExtensions,
        });
    }


    private closeModal() {
        this.setState({ modal: this.state.prevModal, prevModal: null });
    }


    private openAuth() {
        this.setState({ modal: 'auth', prevModal: this.state.modal });
    }


    private openSamples() {
        this.setState({ modal: 'samples' });
    }

    private selectSample(file: string) {
        this.setState({ modal: null });

        const xml = this.props.app.getSample(this.state.platform!.key, file);

        this.readBlocklyContents(xml);
    }


    private openThemes() {
        this.setState({ modal: 'themes' });
    }

    private selectTheme(theme: string) {
        this.closeModal();

        document.body.className = `theme-${theme}`;
    }


    private openExtensions() {
        this.setState({ modal: 'extensions' });
    }

    private selectExtension(extension: Extension) {
        this.closeModal();

        const { extensionsActive } = this.state;

        this.setState({
            extensionsActive: [...extensionsActive, extension],
        });
    }


    private onTerminalClose() {
        this.closeModal();
    }




    private hasCapability(capability: Capability) {
        if (!this.state.platform) return false;

        return this.state.platform.capabilities.indexOf(capability) !== -1;

    }

    private getExtensions() {
        if (!this.state.platform) return [];

        return this.state.platform.extensions;
    }


    private initTerminal(terminalView: RemoteShellView) {
        if (this.remoteShellView !== terminalView) {
            this.remoteShellView = terminalView;

            this.props.app.assignTerminal(terminalView);
        }
    }


    private getPythonCode() {
        return this.state.doc.python || '';
    }


    private openAdvancedFunctionDialog() {
        this.setState({ modal: 'functions' });
    }

    private fileChange(fileName: string) {
        this.setState({ fileName });
    }
    

    private openPlatforms() {
        this.new();
        this.setState({ modal: 'platform' });
    }

    private modeQuestion() {
        this.setState({ modal: 'codeOverwrite' });
    }

    private getAdvancedFunctionList(): SelectModalOption[] {
        let advancedFunctions = AdvancedFunctions;

        if (this.state.platform && this.state.platform.capabilities.indexOf('HexFlash') !== -1) {
            advancedFunctions = [...advancedFunctions, 'Flash Hex'];
            advancedFunctions = [...advancedFunctions, 'Extensions'];
        }

        return advancedFunctions.map((func) => ({
            label: func,
            obj: func,
        }));
    }

    private getLanguagesList(): SelectModalOption[] {
        let languages = Languages;

        return languages.map((func) => ({
            label: func,
            obj: func,
        }));
    }

    private async runLanguages(func: Languages) {
        if (func === 'English') {
            navLabels = ["New", "Open", "Save", "Samples", "Extras", "Run", "Login", "Untitled", "Download Hex", "Download", "Themes"];
            
            generic = ["Open", 
            "Go", 
            "Select", 
            "Close", 
            "Delete", 
            "Yes", 
            "No", 
            "Attention!", 
            "There is no code to run!", 
            "Changing mode will make you lose your code, do you wish to continue?", 
            "Uploading...", 
            "Select your mode",
            "Files"];

            document.getElementById("menubar")!.innerHTML = navLabels[0];
            document.getElementById("menubar")!.innerHTML = generic[0];
            await this.closeModal();
        }

        if (func === 'French') {
            navLabels = ["Nouveau", "Ouvrir", "Sauvegarder", "Exemples", "Préférences", "Exécuter", "S'identifier", "Sans Titre", "Télécharger Hex", "Télécharger", "Thèmes"];
            
            generic = [ "Ouvert", 
                        "Aller", 
                        "Sélectionner", 
                        "Fermer", 
                        "Effacer", 
                        "Oui", 
                        "Non", 
                        "Attention!", 
                        "Il n’y a pas de code à exécuter!", 
                        "Changer le mode te fera perdre ton code, souhaites-tu continuer?",
                        "Téléchargement...", 
                        "Sélectionnez votre mode",
                        "Des dossiers"];

            document.getElementById("menubar")!.innerHTML = generic[0];
            document.getElementById("menubar")!.innerHTML = navLabels[0];
            await this.closeModal();
        }
    }

    private async runAdvancedFunction(func: AdvancedFunction) {
        if (func === 'Export Python') {
            await this.downloadPython();
            await this.closeModal();
        }

        if (func === 'Themes') {
            await this.openThemes();
            
        }


        if (func === 'Switch Language') {
            this.setState({ modal: 'languages' });
        }

        if (func === 'Split View') {
            let blocklyEditor = document.getElementById('blockly') as HTMLBodyElement;
            let pythonEditor = document.getElementById('python') as HTMLBodyElement;
            let editorElement = document.getElementById('editor') as HTMLBodyElement;
            

            blocklyEditor.style.width = "60%";
            editorElement.style.width = "40%";

            window.dispatchEvent(new Event('resize'))

            pythonEditor.classList.add("show-editor");

            await this.closeModal();
        }

        if (func === 'Extensions') {
            await this.openExtensions();
        }

        if (func === 'Flash Hex') {
            const python = this.state.doc.python;

            if (python) {
                this.setState({ modal: 'progress', progress: 0 });

                try {
                    await this.props.app.flashHex(python, this.state.extensionsActive, (progress) => {
                        this.setState({ progress });
                    });
                } finally {
                    this.setState({ modal: null });
                }
            }
        }


    }


    public render() {
        const availablePlatforms = getPlatformList();

        return (
            <div id='page'>
                <ImageModal
                    title={generic[11]}
                    options={availablePlatforms}
                    visible={this.state.modal === 'platform'}
                    onSelect={(platform) => this.selectPlatform(platform.platform) && this.new()}
                    onCancel={() => {
                    }}
                />

                <AuthModal
                    visible={this.state.modal === 'auth'}
                    onClose={() => this.closeModal()}
                />

                <AlertModal
                    title={generic[7]}
                    visible={this.state.modal === 'pythonOverwritten'}
                    text={generic[8]}
                    onCancel={() => {
                    }}
                    onButtonClick={(key) => key === 'close' && this.closeModal()}
                />

                <OverModal
                    title={generic[7]}
                    visible={this.state.modal === 'codeOverwrite'}
                    text={generic[9]}
                    onCancel={() => {
                    }}
                    onButtonClick={(key) => key === 'close' && this.closeModal()}
                    onYes={(key1) => key1 === 'yes' && this.openPlatforms()}
                />

                <AlertModal
                    title={generic[7]}
                    visible={this.state.modal === 'https'}
                    text='Need to switch to HTTPS...'
                    onCancel={() => {
                    }}
                    onButtonClick={(key) => key === 'close' && this.closeModal()}
                />

                <AlertModal
                    title={generic[7]}
                    visible={this.state.modal === 'noCode'}
                    text={generic[8]}
                    onCancel={() => {
                    }}
                    onButtonClick={(key) => key === 'close' && this.closeModal()}
                />

                <AlertModal
                    title='Uh oh!'
                    visible={this.state.modal === 'error'}
                    text='Something went wrong'
                    onCancel={() => {
                    }}
                    onButtonClick={(key) => key === 'close' && this.closeModal()}
                />

                <UploadModal
                    title={generic[10]}
                    visible={this.state.modal === 'progress'}
                    text={`${(this.state.progress * 100) | 0}%`}
                    progress={this.state.progress * 100}
                    onCancel={() => {
                    }}
                    onButtonClick={(key) => key === 'close' && this.closeModal()}
                />

                <Nav
                    platformImg={this.state.platform && this.state.platform.image}
                    sync={this.state.doc.pythonClean}
                    openPlatforms={() => this.openPlatforms()}
                    modeQuestion={() => this.modeQuestion()}
                    openTerminal={this.hasCapability('RemoteShell') || this.hasCapability('TrinketShell') ? () => this.openTerminal() : undefined}
                    downloadPython={this.hasCapability('PythonDownload') ? () => this.downloadPython() : undefined}
                    downloadHex={this.hasCapability('HexDownload') ? () => this.downloadHex() : undefined}
                    openCode={() => this.openFile()}
                    saveCode={() => this.saveFile()}
                    newCode={() => this.new()}
                    openSamples={() => this.openSamples()}
                    openExtensions={this.getExtensions().length ? () => this.openExtensions() : undefined}
                    openThemes={() => this.openThemes()}
                    onFunction={() => this.openAdvancedFunctionDialog()}
                    onFileChange={(fileName) => this.fileChange(fileName)}
                    openAuth={() => this.openAuth()}
                    closeAuth={() => this.closeModal()}
                />

                <section id='workspace'>
                    <button
                        id='toggleViewButton'
                        onClick={() => this.toggleView()}
                    >

                        {this.state.viewMode}

                    </button>

                    <BlocklyView
                        visible={this.state.viewMode === 'blocks'}
                        xml={this.state.doc.xml}
                        extensionsActive={this.state.extensionsActive}
                        onChange={(xml, python) => this.onBlocklyChange(xml, python)}
                    />

                    <PythonView
                        visible={this.state.viewMode === 'python'}
                        python={this.state.doc.python}
                        onChange={(python) => this.onPythonChange(python)}
                    />
                </section>

                {this.hasCapability('RemoteShell') &&
                    <RemoteShellView
                        ref={(c) => this.initTerminal(c)}
                        visible={this.state.modal === 'terminal'}
                        onClose={() => this.onTerminalClose()}
                    />
                }

                {this.hasCapability('TrinketShell') &&
                    <TrinketView
                        pythonCode={this.getPythonCode()}
                        visible={this.state.modal === 'terminal'}
                        onClose={() => this.onTerminalClose()}
                    />
                }

                <FirebaseSelectModal
                    title={generic[12]}
                    options={this.state.files}
                    selectLabel='Open'
                    buttons={[]}
                    visible={this.state.modal === 'files'}
                    onSelect={(file: FileFirebaseSelectModalOption) => this.openFirebaseFile(file.ref)}
                    onDelete={(file: FileFirebaseSelectModalOption) => this.deleteFirebaseFile(file.ref)}
                    onButtonClick={(key) => key === 'close' && this.closeModal()}
                />

                <SelectModal
                    title={navLabels[3]}
                    options={this.state.platform ? this.props.app.getSamples(this.state.platform.key).map((label) => ({ label })) : []}
                    selectLabel={generic[0]}
                    buttons={[]}
                    visible={this.state.modal === 'samples'}
                    onSelect={(file) => this.selectSample(file.label)}
                    onButtonClick={(key) => key === 'close' && this.closeModal()}
                />

                <SelectModal
                    title={navLabels[10]}
                    options={this.props.app.getThemes().map((label) => ({ label }))}
                    selectLabel={generic[2]}
                    buttons={[]}
                    visible={this.state.modal === 'themes'}
                    onSelect={(theme) => this.selectTheme(theme.label)}
                    onButtonClick={(key) => key === 'close' && this.closeModal()}
                />

                <SelectModal
                    title={generic[4]}
                    selectLabel={generic[1]}
                    buttons={[]}
                    visible={this.state.modal === 'functions'}
                    options={this.getAdvancedFunctionList()}
                    onSelect={(func) => this.runAdvancedFunction(func.label as AdvancedFunction)}
                    onButtonClick={(key) => key === 'close' && this.closeModal()}
                />

                <SelectModal
                    title='Switch Language'
                    selectLabel={generic[2]}
                    buttons={[]}
                    visible={this.state.modal === 'languages'}
                    options={this.getLanguagesList()}
                    onSelect={(func) => this.runLanguages(func.label as Languages)}
                    onButtonClick={(key) => key === 'close' && this.closeModal()}
                />


                {this.getExtensions().length > 0 &&
                    <SelectModal
                        title='Extensions'
                        options={this.getExtensions().map((label) => ({ label }))}
                        selectLabel={generic[2]}
                        buttons={[]}
                        visible={this.state.modal === 'extensions'}
                        onSelect={(extension) => this.selectExtension(extension.label as Extension)}
                        onButtonClick={(key) => key === 'close' && this.closeModal()}
                    />
                }

            </div>
        );
    }
}
