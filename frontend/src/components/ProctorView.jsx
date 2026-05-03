import React, { useRef, useEffect, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';

const ProctorView = ({ onViolation, isEnrolling = false, onEnroll }) => {
    const videoRef = useRef(null);
    const [model, setModel] = useState(null);
    const lastCheckTime = useRef(Date.now());

    useEffect(() => {
        let stream = null;
        const loadModelAndCamera = async () => {
            try {
                // Request camera
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                // Load model
                const net = await blazeface.load();
                setModel(net);
            } catch (err) {
                console.error("Failed to access camera or load model:", err);
            }
        };
        loadModelAndCamera();

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    useEffect(() => {
        if (!model || !videoRef.current) return;

        let lastViolationTime = 0;

        const detect = async () => {
            if (videoRef.current && videoRef.current.readyState >= 3) {
                try {
                    const predictions = await model.estimateFaces(videoRef.current, false);
                    
                    const now = Date.now();
                    if (now - lastViolationTime > 5000) {
                        if (predictions.length === 0) {
                            onViolation('face_missing', 'high', 'No face detected in webcam');
                            lastViolationTime = now;
                        } else if (predictions.length > 1) {
                            onViolation('multiple_faces', 'high', 'Multiple people detected');
                            lastViolationTime = now;
                        }
                    }

                    // Snapshots every 2 minutes
                    if (Date.now() - lastCheckTime.current > 120000) {
                        captureSnapshot();
                        lastCheckTime.current = Date.now();
                    }
                } catch (e) {
                    console.error("Face estimation error:", e);
                }
            }
        };
        
        const timer = setInterval(() => {
            detect();
        }, 1500); // Check every 1.5 seconds

        return () => clearInterval(timer);
    }, [model, onViolation]);

    const captureSnapshot = () => {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        if (isEnrolling && onEnroll) {
            onEnroll(dataUrl);
        }
        return dataUrl;
    };

    return (
        <div className="relative border-2 border-slate-800 rounded-lg overflow-hidden w-64 h-48 bg-black">
            <video
                ref={videoRef}
                autoPlay
                muted
                className="w-full h-full object-cover"
                onCanPlay={() => videoRef.current.play()}
            />
            <div className="absolute top-2 left-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                <span className="text-[10px] uppercase font-bold text-white tracking-widest">Live Monitoring</span>
            </div>
        </div>
    );
};

export default ProctorView;
