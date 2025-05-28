declare module 'ultravox-client' {
  export class UltravoxSession {
    status: 'disconnected' | 'connecting' | 'connected' | 'speaking' | 'listening';
    transcripts: Array<{
      speaker: string;
      text: string;
    }>;

    constructor();
    
    addEventListener(
      event: 'status' | 'transcripts' | 'end',
      listener: () => void
    ): void;

    joinCall(url: string): void;
    leaveCall(): void;
  }
}