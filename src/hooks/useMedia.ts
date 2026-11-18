import { useState, useCallback } from 'react';

export function useMedia() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [displayStream, setDisplayStream] = useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(false);
  const [camEnabled, setCamEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestPermissions = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser does not provide microphone access. Use a recent browser over HTTPS or localhost.');
      }
      // Microphone first: captions only need audio, so a missing/denied camera must not block the meeting.
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      let combined = audioStream;
      let hasCamera = false;
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        combined = new MediaStream([...audioStream.getAudioTracks(), ...videoStream.getVideoTracks()]);
        hasCamera = true;
      } catch { /* no camera or camera denied: continue audio-only */ }
      setStream(combined);
      setCamEnabled(hasCamera);
      setMicEnabled(true);
      setError(hasCamera ? null : 'Camera unavailable: continuing with audio only.');
      return true;
    } catch (err: unknown) {
      console.error('Media permission error:', err);
      setCamEnabled(false);
      setMicEnabled(false);
      const denied = err instanceof DOMException && err.name === 'NotAllowedError';
      setError(denied ? 'Microphone permission was denied. Allow microphone access in your browser to use captions.' : err instanceof Error ? err.message : 'Microphone permission denied.');
      return false;
    }
  }, []);

  const toggleMic = useCallback(() => {
    setMicEnabled(prev => {
      const newState = !prev;
      if (stream) {
        stream.getAudioTracks().forEach(track => { track.enabled = newState; });
      }
      return newState;
    });
  }, [stream]);

  const toggleCam = useCallback(async () => {
    if (!camEnabled) {
      // Turning ON
      try {
        if (!stream && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const userStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: micEnabled });
          setStream(userStream);
        } else if (stream) {
          stream.getVideoTracks().forEach(track => { track.enabled = true; });
        }
        setCamEnabled(true);
      } catch (err) {
        console.error("Camera access error:", err);
        setCamEnabled(false);
        setError(err instanceof Error ? err.message : 'Camera access denied.');
      }
    } else {
      // Turning OFF
      if (stream) {
        stream.getVideoTracks().forEach(track => { track.enabled = false; });
      }
      setCamEnabled(false);
    }
  }, [camEnabled, micEnabled, stream]);

  const startScreenShare = useCallback(async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setDisplayStream(screenStream);
        
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          setDisplayStream(null);
        };
      }
      setIsScreenSharing(true);
    } catch (err) {
      console.error("Error sharing screen:", err);
      setIsScreenSharing(false);
      setError(err instanceof Error ? err.message : 'Screen sharing could not start.');
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    setIsScreenSharing(false);
    setDisplayStream(prev => {
      if (prev) {
        prev.getTracks().forEach(track => track.stop());
      }
      return null;
    });
  }, []);

  const stopAllMedia = useCallback(() => {
    // Meeting chhodte waqt camera/mic ke tracks sach mein release karte hain.
    stream?.getTracks().forEach(track => track.stop());
    displayStream?.getTracks().forEach(track => track.stop());
    setStream(null);
    setDisplayStream(null);
    setMicEnabled(false);
    setCamEnabled(false);
    setIsScreenSharing(false);
  }, [stream, displayStream]);

  return {
    stream,
    displayStream,
    micEnabled,
    camEnabled,
    isScreenSharing,
    error,
    requestPermissions,
    toggleMic,
    toggleCam,
    startScreenShare,
    stopScreenShare,
    stopAllMedia
  };
}
