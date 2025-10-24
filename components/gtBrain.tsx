console.log("gtBrain placeholder loaded");

export const gtBrain = {
    ensureCapabilities: (caps: any) => {
        console.log('gtBrain.ensureCapabilities called with:', caps);
        return Promise.resolve({ ok: true, installed: [], reason: '', logId: '' });
    },
    sendMessageStream: (prompt: any) => {
        console.log('gtBrain.sendMessageStream called with:', prompt);
        return Promise.resolve(async function* () {
            yield { text: "Placeholder response stream." };
        }());
    },
    addToHistory: (user: any, model: any) => {
        console.log('gtBrain.addToHistory called');
    },
    setUserContext: (user: any) => {
        console.log('gtBrain.setUserContext called');
    },
    getLastPrompt: (): string | null => {
        console.log('gtBrain.getLastPrompt called');
        return null;
    },
    backupMemoryLogs: () => {
        console.log('gtBrain.backupMemoryLogs called');
    },
    backupSandboxState: () => {
        console.log('gtBrain.backupSandboxState called');
    },
    addUploadedFile: (file: any) => {
        console.log('gtBrain.addUploadedFile called');
    },
    executeTerminalCommand: (command: any) => {
        console.log('gtBrain.executeTerminalCommand called with:', command);
        return Promise.resolve({ outputLines: [{text: `> ${command}`}, {text: 'Placeholder command output.'}] });
    },
};
