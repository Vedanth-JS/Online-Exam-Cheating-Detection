import { useEffect, useRef } from 'react';

export const useAudioMonitor = (onViolation, threshold = 0.2) => {
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);

    useEffect(() => {
        let stream;
        const startMonitoring = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                audioContextRef.current = new AudioContext();
                analyserRef.current = audioContextRef.current.createAnalyser();
                const source = audioContextRef.current.createMediaStreamSource(stream);
                source.connect(analyserRef.current);
                
                analyserRef.current.fftSize = 256;
                const bufferLength = analyserRef.current.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);

                let lastViolationTime = 0;

                const checkAudio = () => {
                    analyserRef.current.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < bufferLength; i++) {
                        sum += dataArray[i];
                    }
                    const average = sum / bufferLength / 255;
                    
                    if (average > threshold) {
                        const now = Date.now();
                        if (now - lastViolationTime > 5000) {
                            onViolation('audio_detected', 'medium', 'Sustained noise detected');
                            lastViolationTime = now;
                        }
                    }
                    requestAnimationFrame(checkAudio);
                };
                checkAudio();
            } catch (err) {
                console.error("Audio monitoring failed", err);
            }
        };

        startMonitoring();

        return () => {
            if (stream) stream.getTracks().forEach(track => track.stop());
            if (audioContextRef.current) audioContextRef.current.close();
        };
    }, [onViolation, threshold]);
};
