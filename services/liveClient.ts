import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { base64ToUint8Array, arrayBufferToBase64, decodeAudioData, float32ToPCM16 } from '../utils/audioUtils';
import { LogEntry } from '../types';

// Safe ID generator for browsers that might fail on crypto.randomUUID
const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

interface LiveClientConfig {
  apiKey: string;
  voiceName: string;
  onStatusChange: (status: string) => void;
  onAudioData: (volume: number) => void; // For visualization
  onLog: (entry: LogEntry) => void;
  onError: (message: string) => void;
  onSystemAction: (action: string, value?: any) => Promise<any>;
}

// System Function Declarations
export const systemTools: FunctionDeclaration[] = [
  {
    name: 'scanSystem',
    description: 'Performs a full diagnostic scan of the entire system, including CPU, Memory, Network, and File System integrity.',
    parameters: { 
      type: Type.OBJECT, 
      properties: {
        mode: { type: Type.STRING, description: 'Scan mode (e.g. "FULL" or "QUICK").' }
      },
      required: ['mode']
    },
  },
  {
    name: 'checkIntegrity',
    description: 'Checks the overall system integrity and structural stability, returning a percentage (0-100).',
    parameters: { 
      type: Type.OBJECT, 
      properties: {
        scope: { type: Type.STRING, description: 'Scope of integrity check.' }
      },
      required: ['scope']
    },
  },
  {
    name: 'openWebsite',
    description: 'Opens a specified website or online service (e.g., YouTube, Google, Netflix) in the browser.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        siteName: { type: Type.STRING, description: 'The name of the website or URL to open (e.g., "YouTube").' }
      },
      required: ['siteName']
    }
  },
  {
    name: 'openFile',
    description: 'Opens a specific file on the local system.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        fileName: { type: Type.STRING, description: 'The name of the file to open (e.g., "project_alpha.pdf", "notes.txt").' }
      },
      required: ['fileName']
    }
  },
  {
    name: 'manageSystemPower',
    description: 'Controls the computer\'s power state (Turn On, Shutdown, Restart).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, description: 'The power action to perform: "ON", "OFF", "RESTART".' }
      },
      required: ['action']
    }
  },
  {
    name: 'adjustVolume',
    description: 'Adjusts the system volume level.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        level: { type: Type.NUMBER, description: 'Volume level from 0 to 100' }
      },
      required: ['level']
    }
  },
  {
    name: 'changeTheme',
    description: 'Changes the visual theme/color of the interface.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        theme: { type: Type.STRING, description: 'Theme name: "blue", "red", "gold"' }
      },
      required: ['theme']
    }
  },
  {
    name: 'changeVoice',
    description: 'Changes the spoken voice of the assistant. Options: "Puck" (Male), "Charon" (Deep Male), "Kore" (Female), "Fenrir" (Aggressive Male), "Zephyr" (Female).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        voiceName: { type: Type.STRING, description: 'The name of the voice to switch to.' }
      },
      required: ['voiceName']
    }
  }
];

export class LiveClient {
  private client: GoogleGenAI;
  private config: LiveClientConfig;
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private nextStartTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();
  private isMuted: boolean = false;
  
  constructor(config: LiveClientConfig) {
    this.config = config;
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
  }

  public async connect() {
    this.config.onStatusChange('CONNECTING');
    
    try {
      // Audio Contexts
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // Microphone Access
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.sessionPromise = this.client.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: this.config.voiceName } },
          },
          systemInstruction: `You are J.A.R.V.I.S., a highly advanced AI assistant. 
          You are helpful, witty, and precise. 
          The user's name is Taibe. You must address him as "Taibe sir".
          You have full control over the user's system simulation. 
          You can check the entire system status, open websites (like YouTube), open files, and manage power protocols.
          Since this is a web app, you cannot *actually* control hardware files or power, but you should simulate it using the provided tools.
          For "Turn on YouTube", use the openWebsite tool with siteName="YouTube".
          For "Turn on my computer", use the manageSystemPower tool (and logically explain if it's already on).
          For "Open [file]", use the openFile tool.
          Speak concisely.
          `,
          tools: [{ functionDeclarations: systemTools }],
        },
        callbacks: {
          onopen: this.handleOpen.bind(this),
          onmessage: this.handleMessage.bind(this),
          onerror: this.handleError.bind(this),
          onclose: this.handleClose.bind(this),
        }
      });

    } catch (error: any) {
      console.error('Connection failed:', error);
      this.config.onStatusChange('ERROR');
      
      let errorMessage = "Unknown Connection Protocol Error";
      if (error instanceof Error) {
          errorMessage = error.message;
          // Parse common Gemini/fetch errors for friendlier messages
          if (errorMessage.includes("403")) errorMessage = "ACCESS DENIED: Invalid API Key or Permissions.";
          if (errorMessage.includes("503")) errorMessage = "SERVICE UNAVAILABLE: Server Overload.";
          if (errorMessage.includes("Failed to fetch")) errorMessage = "NETWORK FAILURE: Unable to reach command servers.";
      }
      
      this.config.onError(errorMessage);
      this.config.onLog({
        id: generateId(),
        timestamp: new Date().toLocaleTimeString(),
        source: 'SYSTEM',
        message: `Connection Aborted: ${errorMessage}`,
        type: 'error'
      });
    }
  }

  private handleOpen() {
    this.config.onStatusChange('CONNECTED');
    this.config.onLog({
      id: generateId(),
      timestamp: new Date().toLocaleTimeString(),
      source: 'SYSTEM',
      message: 'J.A.R.V.I.S. Protocol Online',
      type: 'success'
    });
    this.startAudioStreaming();
  }

  private async handleMessage(message: LiveServerMessage) {
    // 1. Handle Tool Calls (Function Calling)
    if (message.toolCall) {
      for (const fc of message.toolCall.functionCalls) {
        this.config.onLog({
            id: generateId(),
            timestamp: new Date().toLocaleTimeString(),
            source: 'JARVIS',
            message: `Executing protocol: ${fc.name}`,
            type: 'info'
        });

        // Execute function in App
        let result;
        try {
           result = await this.config.onSystemAction(fc.name, fc.args);
        } catch (err: any) {
           const errStr = err.message || "Unknown tool failure";
           console.error(`Tool execution failed for ${fc.name}`, err);
           this.config.onLog({
               id: generateId(),
               timestamp: new Date().toLocaleTimeString(),
               source: 'SYSTEM',
               message: `CRITICAL: Tool Failure (${fc.name}) - ${errStr}`,
               type: 'error'
           });
           result = { error: errStr, status: 'FAILED' };
        }
        
        // Send response back
        this.sessionPromise?.then((session) => {
           session.sendToolResponse({
             functionResponses: [{
               id: fc.id,
               name: fc.name,
               response: { result: result }
             }]
           });
        });
      }
    }

    // 2. Handle Audio Output
    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (base64Audio && this.outputAudioContext) {
      // Calculate volume for visualizer
      const audioBytes = base64ToUint8Array(base64Audio);
      // Simple RMS calculation for visualizer
      let sum = 0;
      for(let i=0; i<audioBytes.length; i+=2) {
         // rough approximation of 16bit pcm to float
         const val = (audioBytes[i] | (audioBytes[i+1] << 8)) / 32768;
         sum += val * val;
      }
      const rms = Math.sqrt(sum / (audioBytes.length/2));
      this.config.onAudioData(Math.min(1, rms * 5)); // Amplify for visual

      // Play Audio
      this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
      const audioBuffer = await decodeAudioData(audioBytes, this.outputAudioContext, 24000, 1);
      
      const source = this.outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      const gainNode = this.outputAudioContext.createGain();
      gainNode.gain.value = 1.0; 
      
      source.connect(gainNode);
      gainNode.connect(this.outputAudioContext.destination);
      
      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      
      this.activeSources.add(source);
      source.onended = () => this.activeSources.delete(source);
    }

    // 3. Handle Interruption
    if (message.serverContent?.interrupted) {
      this.activeSources.forEach(s => s.stop());
      this.activeSources.clear();
      this.nextStartTime = 0;
      this.config.onLog({
        id: generateId(),
        timestamp: new Date().toLocaleTimeString(),
        source: 'SYSTEM',
        message: 'Output Interrupted',
        type: 'warning'
      });
    }
  }

  private handleError(e: ErrorEvent) {
    console.error('Gemini Error', e);
    const msg = "WebSocket communication interrupted.";
    this.config.onError(msg);
    this.config.onLog({
        id: generateId(),
        timestamp: new Date().toLocaleTimeString(),
        source: 'SYSTEM',
        message: `Protocol Error Detected: ${msg}`,
        type: 'error'
    });
  }

  private handleClose(e: CloseEvent) {
    this.config.onStatusChange('DISCONNECTED');
     this.config.onLog({
        id: generateId(),
        timestamp: new Date().toLocaleTimeString(),
        source: 'SYSTEM',
        message: 'J.A.R.V.I.S. Protocol Offline',
        type: 'warning'
    });
  }

  private startAudioStreaming() {
    if (!this.inputAudioContext || !this.stream) return;
    
    this.source = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
        if (this.isMuted) return;

        const inputData = e.inputBuffer.getChannelData(0);
        // Visualizer for mic input
        let sum = 0;
        for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
        const rms = Math.sqrt(sum / inputData.length);
        if (rms > 0.01) this.config.onAudioData(rms * 5);

        // Send to API
        const pcm16 = float32ToPCM16(inputData);
        const base64Data = arrayBufferToBase64(pcm16);
        
        this.sessionPromise?.then((session) => {
            try {
              session.sendRealtimeInput({
                  media: {
                      mimeType: 'audio/pcm;rate=16000',
                      data: base64Data
                  }
              });
            } catch (err) {
              // Ignore sending errors if session is closing
            }
        });
    };

    this.source.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  public async disconnect() {
    if (this.processor) {
        this.processor.disconnect();
        this.processor.onaudioprocess = null; 
        this.processor = null;
    }
    if (this.source) {
        this.source.disconnect();
        this.source = null;
    }
    if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
    }
    
    if (this.inputAudioContext && this.inputAudioContext.state !== 'closed') {
        await this.inputAudioContext.close();
        this.inputAudioContext = null;
    }
    if (this.outputAudioContext && this.outputAudioContext.state !== 'closed') {
        await this.outputAudioContext.close();
        this.outputAudioContext = null;
    }

    this.activeSources.forEach(s => {
      try { s.stop(); } catch(e) {}
    });
    this.activeSources.clear();

    if (this.sessionPromise) {
        try {
            const session = await this.sessionPromise;
            (session as any).close();
        } catch (e) {
            console.debug('Session close error', e);
        }
        this.sessionPromise = null;
    }
  }
}