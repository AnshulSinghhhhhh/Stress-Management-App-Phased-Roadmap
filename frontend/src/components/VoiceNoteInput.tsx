import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Lock, AlertCircle } from 'lucide-react';

interface VoiceNoteInputProps {
  value: string;
  onChange: (text: string) => void;
  title?: string;
  subtitle?: string;
  placeholder?: string;
}

interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export const VoiceNoteInput: React.FC<VoiceNoteInputProps> = ({
  value,
  onChange,
  title = 'Voice Note & Free Text',
  subtitle = 'Optional voice memo or written context',
  placeholder = 'Take your time to write any thoughts here... (optional)',
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const windowWithSpeech = window as unknown as IWindow;
    const SpeechClass =
      windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;

    if (!SpeechClass) {
      setSpeechSupported(false);
      return;
    }

    try {
      const recognition = new SpeechClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          onChange(value ? `${value} ${transcript}` : transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setRecognitionError('Microphone permission not granted. You can still type freely below.');
        } else {
          setRecognitionError('Voice input ended. You can type freely below.');
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    } catch (err) {
      console.warn('Speech recognition init error:', err);
      setSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [value, onChange]);

  const toggleRecording = () => {
    setRecognitionError(null);
    if (!speechSupported) {
      setRecognitionError('Voice recognition is not supported in this browser. Please type below.');
      return;
    }

    if (isRecording) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsRecording(true);
      } catch (err) {
        console.warn('Failed to start speech recognition:', err);
        setRecognitionError('Could not start microphone. You can type freely below.');
        setIsRecording(false);
      }
    }
  };

  return (
    <section className="bg-surfaceLowest border border-outline-variant rounded-2xl p-6 shadow-resting space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-headline text-lg text-on-surface font-semibold">
            {title}
          </h3>
          <p className="text-sm text-stone-700">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Voice Pill & Audio Visualizer Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-3.5 rounded-xl bg-surface-container-low border border-outline-variant gap-3">
        <button
          type="button"
          onClick={toggleRecording}
          aria-label={isRecording ? 'Stop voice recording' : 'Start voice note recording'}
          className={`w-full sm:w-auto inline-flex items-center justify-center space-x-2.5 px-4 py-2 rounded-full border text-sm font-semibold transition-all duration-200 ${
            isRecording
              ? 'bg-terracotta-container text-terracotta-dark border-terracotta/40 animate-pulse'
              : 'bg-surfaceLowest border-outline-variant hover:border-primary text-on-surface hover:shadow-xs'
          }`}
        >
          {isRecording ? (
            <>
              <MicOff className="w-4 h-4 text-terracotta-dark" />
              <span>Listening... Tap to finish</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 text-primary" />
              <span>Tap to record voice note</span>
            </>
          )}
        </button>

        {/* Audio Waveform Visualizer */}
        <div className="flex items-center space-x-1.5 h-6 px-3" aria-hidden="true">
          <span className={`w-1 rounded-full bg-outline-variant transition-all duration-300 ${isRecording ? 'h-4 animate-pulse' : 'h-2'}`} />
          <span className={`w-1 rounded-full bg-secondary-container transition-all duration-300 ${isRecording ? 'h-6 animate-pulse' : 'h-3'}`} />
          <span className={`w-1 rounded-full bg-primary transition-all duration-300 ${isRecording ? 'h-5 animate-pulse' : 'h-4'}`} />
          <span className={`w-1 rounded-full bg-primary transition-all duration-300 ${isRecording ? 'h-6 animate-pulse' : 'h-5'}`} />
          <span className={`w-1 rounded-full bg-secondary-container transition-all duration-300 ${isRecording ? 'h-5 animate-pulse' : 'h-3'}`} />
          <span className={`w-1 rounded-full bg-primary transition-all duration-300 ${isRecording ? 'h-6 animate-pulse' : 'h-4'}`} />
          <span className={`w-1 rounded-full bg-outline-variant transition-all duration-300 ${isRecording ? 'h-3 animate-pulse' : 'h-2'}`} />
        </div>
      </div>

      {recognitionError && (
        <div className="flex items-center space-x-2 text-sm text-terracotta-dark bg-terracotta-container/60 px-3.5 py-2.5 rounded-xl border border-terracotta/30">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{recognitionError}</span>
        </div>
      )}

      {/* Textarea */}
      <div className="relative space-y-1.5">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded-xl bg-surface border border-outline-variant p-4 text-sm md:text-base text-on-surface placeholder:text-stone-700 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 resize-none transition-colors duration-200"
        />
        <div className="flex justify-between items-center px-1 text-sm text-stone-700">
          <span className="flex items-center space-x-1.5">
            <Lock className="w-4 h-4 text-primary" />
            <span>Encrypted locally on device</span>
          </span>
          <span className="text-stone-700 font-medium">Text only analysis</span>
        </div>
      </div>
    </section>
  );
};
