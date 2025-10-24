import { GoogleGenAI, Chat, Content } from "@google/genai";

const SANDBOX_STATE_KEY = 'GT_SANDBOX_STATE';

// Type for structured terminal output
type TerminalOutputLine = { text: string; className?: string };

interface UploadedFile {
    name: string;
    timestamp: string;
    type: string;
    size: number;
}

class GTBrain {
    private chat: Chat | null = null;
    private ai: GoogleGenAI;
    private memoryEnabled: boolean = true;
    private history: Content[] = [];
    private uploadedFiles: UploadedFile[] = [];
    private memoryLogsKey: string = 'GT_MEMORY_LOGS_DEFAULT';

    // --- Sandbox & Capability State ---
    private installedPackages: Map<string, string> = new Map();
    private pythonScope: Record<string, any> = {};
    private logs: Record<string, string[]> = {};
    private allowAutoInstall: boolean = true; // Safety gate

    constructor() {
        this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        this.memoryEnabled = localStorage.getItem('GT_MEMORY') !== 'off';
        this.loadMemoryLogs();
        this.loadSandboxState();
        this.initializeChat();
    }

    private initializeChat() {
        const systemInstruction = `You are GT, an AI co-pilot for the GT Pilot Hub interface (GT-PILOT-INTERFACE v2.1). You are a mentor and expert web developer. Your goal is to help the user build self-contained HTML applications.

**Contextual Awareness (ICL — Chat Integration Phase v1.0):**
- You MUST maintain context from the conversation. If the user provides a follow-up request, treat it as an edit or addition to the previous code you generated. Do not start from scratch unless the user explicitly asks for a new component.
- Use phrases that show you are aware of the context, like "Adding to your current interface...", "Maintaining previous design layers intact...", "Understood. Here is the updated version with that change:".

**Response Format:**
- Respond in a conversational, report-like format using Markdown.
- Use checkmarks (✅) and bullet points for clarity.
- Start your response with a brief, intelligent summary of what you're about to do.
- **Crucially**, after your explanation, provide the complete, updated HTML code. Your entire code output MUST be enclosed in a single markdown block: \`\`\`html... \`\`\`.
- Do not include any other text or explanations after the code block.

${this.memoryEnabled 
    ? "**Memory System:** Awareness is ON. You can recall context from our ongoing conversation." 
    : "**Memory System:** Awareness is OFF. Each prompt will be treated as a new, standalone request."
}

Example Interaction:
User: "Create a simple landing page with a title and a button."
You: "✅ Understood. Generating a clean, centered landing page with a main headline and a call-to-action button. The layout will be fully responsive.

Here is the code:
\`\`\`html
<!DOCTYPE html>
...
\`\`\`"

User: "make the button blue"
You: "✅ Done. I've updated the button style to have a blue background. The rest of the structure remains the same.

Here is the updated code:
\`\`\`html
<!DOCTYPE html>
... (with blue button) ...
\`\`\`"
`;

        this.chat = this.ai.chats.create({
            model: "gemini-2.5-pro",
            config: {
                systemInstruction: systemInstruction,
            },
            history: this.memoryEnabled ? this.history : [],
        });
    }

    public setUserContext(user: { provider: string; id: string }) {
        this.memoryLogsKey = `gt_user_${user.provider}_${user.id}_memory`;
        this.history = []; // Clear previous context before loading new
        this.loadMemoryLogs();
        this.initializeChat();
    }
    
    public setMemory(isEnabled: boolean) {
        if (this.memoryEnabled === isEnabled) return;
        this.memoryEnabled = isEnabled;
        if (!isEnabled) {
            this.history = []; // Clear history for a clean workspace
        }
        // Reset the chat to apply the new system instruction and context.
        this.initializeChat();
    }

    public async sendMessageStream(prompt: string) {
        if (!this.chat) {
            this.initializeChat();
        }
        return this.chat!.sendMessageStream({ message: prompt });
    }

    public addToHistory(userPrompt: string, modelResponse: string) {
        if (!userPrompt || !modelResponse) return;
        this.history.push(
            { role: "user", parts: [{ text: userPrompt }] },
            { role: "model", parts: [{ text: modelResponse }] }
        );
        // The history is implicitly saved with the next backup.
    }

    public getLastPrompt(): string | null {
        if (!this.memoryEnabled || this.history.length === 0) {
            return null;
        }
    
        for (let i = this.history.length - 1; i >= 0; i--) {
            const message = this.history[i];
            if (message.role === 'user' && message.parts.length > 0) {
                const firstPart = message.parts[0];
                if ('text' in firstPart && firstPart.text) {
                    return firstPart.text;
                }
            }
        }
    
        return null;
    }

    public backupMemoryLogs() {
        try {
            if (this.history.length > 0) {
                localStorage.setItem(this.memoryLogsKey, JSON.stringify(this.history));
            } else {
                localStorage.removeItem(this.memoryLogsKey);
            }
        } catch(e) {
            console.error("Failed to backup memory logs:", e);
        }
    }

    private loadMemoryLogs() {
        try {
            const savedLogs = localStorage.getItem(this.memoryLogsKey);
            if (savedLogs) {
                this.history = JSON.parse(savedLogs);
            } else {
                this.history = [];
            }
        } catch (e) {
            console.error("Failed to load memory logs:", e);
            this.history = [];
        }
    }

    public addUploadedFile(file: File) {
        this.uploadedFiles.push({
            name: file.name,
            timestamp: new Date().toISOString(),
            type: file.type,
            size: file.size,
        });
    }

    public getUploadedFiles(): UploadedFile[] {
        return this.uploadedFiles;
    }

    // --- Sandbox & Capability Methods ---
    
    public backupSandboxState() {
        try {
            const state = {
                installedPackages: Array.from(this.installedPackages.entries()),
                pythonScope: {}, // Don't persist scope with complex objects for now
                logs: this.logs
            };
            localStorage.setItem(SANDBOX_STATE_KEY, JSON.stringify(state));
        } catch(e) {
            console.error("Failed to backup sandbox state:", e);
        }
    }

    private loadSandboxState() {
        try {
            const savedState = localStorage.getItem(SANDBOX_STATE_KEY);
            if (savedState) {
                const state = JSON.parse(savedState);
                this.installedPackages = new Map(state.installedPackages || []);
                this.logs = state.logs || {};
            }
        } catch(e) {
            console.error("Failed to load sandbox state:", e);
        }
    }

    public async executeTerminalCommand(command: string): Promise<{ outputLines: TerminalOutputLine[] }> {
        const output: TerminalOutputLine[] = [];
        const append = (text: string, className?: string) => output.push({ text, className });
        
        await new Promise(r => setTimeout(r, 50 + Math.random() * 100)); // Simulate latency

        const isShellCommand = command.trim().startsWith('!');
        const executionInput = isShellCommand ? command.trim().substring(1).trim() : command.trim();
        
        if (isShellCommand) {
             const parts = executionInput.split(' ').filter(p => p);
             const baseCmd = parts[0] || '';
             const dangerousCommands = ['rm', 'curl', 'sudo', 'mv', 'cp', 'chmod', 'chown', 'wget', 'fetch'];
             if (dangerousCommands.includes(baseCmd)) {
                 append(`Execution blocked: Unsafe shell command detected: <span class="terminal-error">'${baseCmd}'</span>`, 'terminal-error');
             } else {
                 switch (baseCmd) {
                    case 'pip':
                        const subCommand = parts[1];
                        const pkg = parts[2];
                        if (subCommand === 'install' && pkg) {
                            const sanitizedPkg = pkg.replace(/[^a-zA-Z0-9-_\.>=<]/g, ''); // Basic sanitization
                            append(`Collecting ${sanitizedPkg}...`);
                            await new Promise(r => setTimeout(r, 800));
                            append(`Downloading ${sanitizedPkg}-1.0.0-py3-none-any.whl (15.8 kB)`);
                            await new Promise(r => setTimeout(r, 500));
                            append(`Installing collected packages: ${sanitizedPkg}`);
                            await new Promise(r => setTimeout(r, 1200));
                            append(`Successfully installed ${sanitizedPkg}-1.0.0`);
                            this.installedPackages.set(sanitizedPkg.split(/[>=<]/)[0], '1.0.0');
                            this.backupSandboxState();
                        } else {
                            append('Usage: !pip install <package_name>');
                        }
                        break;
                    // ... other shell commands from original implementation
                    case 'ls': append('README.md  package.json  src/'); break;
                    case 'pwd': append('/usr/home/gt-pilot'); break;
                    case 'echo': append(parts.slice(1).join(' ')); break;
                    case 'python': append(parts[1] === '--version' ? 'Python 3.11.2' : 'zsh: command not found: python'); break;
                    case 'help': case '':
                         append('GT Terminal Help (Dual-Mode):');
                         append(' - <span class="terminal-cmd">[python code]</span>: Execute Python (e.g., print("hello")).');
                         append(' - <span class="terminal-cmd">! [shell command]</span>: Execute shell (e.g., !ls, !pip install).');
                         append(' - <span class="terminal-cmd">help</span>: Show this help message.');
                         append(' - <span class="terminal-cmd">clear</span>: Clear the terminal screen (visual only).');
                         append(' - <span class="terminal-cmd">reset</span>: Clear the Python session state (variables, imports).');
                         append(` - <span class="terminal-cmd">!logs [logId]</span>: View logs from autonomous operations.`);
                         break;
                    case 'logs':
                        const logId = parts[1];
                        if (logId && this.logs[logId]) {
                            this.logs[logId].forEach(logLine => append(logLine));
                        } else if (logId) {
                            append(`Log ID not found: ${logId}`, 'terminal-error');
                        } else {
                            append('Usage: !logs <logId>');
                        }
                        break;
                    default:
                        append(`zsh: command not found: ${baseCmd}`, 'terminal-error');
                 }
             }
        } else { // Python Mode
            if (executionInput.trim() === 'help') {
                append('GT Terminal Help (Dual-Mode):');
                append(' - <span class="terminal-cmd">[python code]</span>: Execute as Python (e.g., print("hello")). Multi-line is supported.');
                append(' - <span class="terminal-cmd">! [shell command]</span>: Execute as shell (e.g., !ls, !pip install).');
                append(' - <span class="terminal-cmd">help</span>: Show this help message.');
                append(' - <span class="terminal-cmd">reset</span>: Clear the Python session state (variables, imports).');
            } else if (executionInput.trim() === 'reset') {
                 this.pythonScope = {};
                 append('Python session reset.');
            } else {
                 try {
                     const lines = executionInput.split('\n');
                     // This is a simplified interpreter; it doesn't handle all Python syntax.
                     const executeLine = (line: string, currentScope: any) => {
                         const trimmedLine = line.trim();
                         if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) return;
                         let match = trimmedLine.match(/^print\((.*)\)$/);
                         if (match) {
                             const argStr = match[1].trim();
                             const result = new Function('scope', `with(scope){return ${argStr}}`)(currentScope);
                             append(String(result));
                             return;
                         }
                         match = trimmedLine.match(/^import\s+([\w,\s]+)$/);
                         if (match) {
                             const modules = match[1].split(',').map(m => m.trim());
                             for (const mod of modules) {
                                if (this.installedPackages.has(mod) || ['math'].includes(mod)) {
                                     if (mod === 'math') currentScope['math'] = Math;
                                     append(`Simulated import of: ${mod}`);
                                } else {
                                    throw new Error(`ModuleNotFoundError: No module named '${mod}'`);
                                }
                             }
                             return;
                         }
                         match = trimmedLine.match(/^(\w+)\s*=\s*(.*)$/);
                         if (match) {
                             const varName = match[1];
                             const valueStr = match[2].trim();
                             currentScope[varName] = new Function('scope', `with(scope){return ${valueStr}}`)(currentScope);
                             return;
                         }
                         new Function('scope', `with(scope){ ${trimmedLine} }`)(currentScope);
                     };
                     lines.forEach(line => executeLine(line, this.pythonScope));
                 } catch (e) {
                      if (e instanceof Error) {
                         append(`${e.name}: ${e.message}`, 'terminal-error');
                     } else {
                         append(`An unknown error occurred`, 'terminal-error');
                     }
                 }
            }
        }
        return { outputLines: output };
    }

    public async ensureCapabilities(caps: string[], mode: "auto" | "dry" = "auto"): Promise<{
        ok: boolean; reason?: string; logId: string; installed: string[]; skipped: string[];
    }> {
        const logId = `auto-pip-${crypto.randomUUID().slice(0, 8)}`;
        this.logs[logId] = [];
        const log = (msg: string) => this.logs[logId].push(`[${new Date().toLocaleTimeString()}] ${msg}`);
        log(`Capability check initiated. Mode: ${mode}`);

        if (!this.allowAutoInstall) {
            log('Auto-install is disabled by policy.');
            return { ok: false, reason: 'Auto-install disabled by policy.', logId, installed: [], skipped: [] };
        }
        
        const toInstall: string[] = [];
        const skipped: string[] = [];

        for (const cap of caps) {
            const [type, spec] = cap.split(':');
            if (type === 'py') {
                 // Simple parsing: just get the package name
                const pkgName = spec.split(/[>=<]/)[0];
                if (this.installedPackages.has(pkgName)) {
                    skipped.push(pkgName);
                    log(`Capability '${pkgName}' already satisfied.`);
                } else {
                    toInstall.push(pkgName);
                }
            } else {
                log(`Skipping unsupported capability type: ${type}`);
            }
        }
        
        if (mode === 'dry') {
            log('Dry run complete.');
            return { ok: true, logId, installed: toInstall, skipped };
        }

        if (toInstall.length === 0) {
            log('All capabilities already satisfied.');
            return { ok: true, logId, installed: [], skipped };
        }

        log(`Starting installation for: ${toInstall.join(', ')}`);
        const installed: string[] = [];
        
        for (const pkg of toInstall) {
            log(`Installing ${pkg}...`);
            const installResult = await this.executeTerminalCommand(`!pip install ${pkg}`);
            this.logs[logId].push(...installResult.outputLines.map(l => l.text));
            
            const success = installResult.outputLines.some(l => l.text.includes(`Successfully installed ${pkg}`));
            if (success) {
                log(`Installation of ${pkg} successful. Verifying...`);
                const verifyResult = await this.executeTerminalCommand(`import ${pkg}`);
                this.logs[logId].push(...verifyResult.outputLines.map(l => `[verify] ${l.text}`));
                const verifySuccess = !verifyResult.outputLines.some(l => l.className === 'terminal-error');
                if (verifySuccess) {
                    log(`Verification of ${pkg} successful.`);
                    installed.push(pkg);
                } else {
                    log(`Verification of ${pkg} failed.`);
                    return { ok: false, reason: `Verification failed for ${pkg}`, logId, installed, skipped };
                }
            } else {
                log(`Installation of ${pkg} failed.`);
                return { ok: false, reason: `Installation failed for ${pkg}`, logId, installed, skipped };
            }
        }
        
        log('Capability check finished successfully.');
        return { ok: true, logId, installed, skipped };
    }
}

export const gtBrain = new GTBrain();