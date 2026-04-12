import React, { useState, useRef, useEffect } from 'react';
import { ActionSheet } from './ActionSheet';
import { showToast } from './Toast';
import type { Item } from '../utils/data';
import heic2any from 'heic2any';
import { logDiagnostic, sendVoiceToN8N } from '../utils/ai';
import { useAuth } from '../context/AuthContext';
import { compressImage } from '../utils/image';
import { useTelegram } from '../hooks/useTelegram';

import './SmartInput.css';


export interface SmartInputProps {
  placeholder?: string;
  onSend: (text: string) => void;
  onImageSelect?: (base64: string) => void;
  baseline?: Item[];
  shoppingList?: Item[];
  stock?: Item[];
  diary?: any[];
  onVoiceResponse?: (data: any) => void;
  // New props for hidden smart input
  smartInputState: 'hidden' | 'active' | 'recording' | 'media';
  onStateChange: (state: 'hidden' | 'active' | 'recording' | 'media') => void;
}

export const SmartInput: React.FC<SmartInputProps> = ({
  placeholder, onSend, onImageSelect,
  baseline, shoppingList, stock, diary,
  onVoiceResponse,
  smartInputState,
  onStateChange,
}) => {
  const { user } = useAuth();
  const { disableVerticalSwipes, enableVerticalSwipes } = useTelegram();


  const [val, setVal] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  // Gesture State v3.02.0
  const [dragOffset, setDragOffset] = useState(0); // in pixels
  const [activeSide, setActiveSide] = useState<'none' | 'left' | 'right'>('none');
  const GESTURE_COMMIT_THRESHOLD = 120; // px to trigger action

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  // Swipe detection refs
  const swipeStartX = useRef<number | null>(null);
  const MIN_RECORDING_MS = 1000;
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const triggerHaptic = (pattern: number | number[]) => {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    navigator.vibrate(pattern);
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const v = window.visualViewport;
    const handleResize = () => {
      if (!v) return;
      // offset is the distance between the bottom of the layout viewport and the bottom of the visual viewport
      const offset = window.innerHeight - v.height;
      // Safari PWA introduces small discrepancies due to the Home Indicator. A real keyboard is > 150px.
      setKeyboardOffset(offset > 150 ? offset : 0);
    };
    v.addEventListener('resize', handleResize);
    v.addEventListener('scroll', handleResize);
    handleResize();
    return () => {
      v.removeEventListener('resize', handleResize);
      v.removeEventListener('scroll', handleResize);
    };
  }, []);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Element;
      if (wrapperRef.current && wrapperRef.current.contains(target)) {
        return;
      }
      
      // Blur the input to close keyboard
      setIsFocused(false);
      
      // If clicking on the tab bar, do NOT close the smart input.
      // The tab bar handles its own click logic (e.g., transition to chat).
      if (target.closest('.glass-tabbar')) {
        return;
      }
      
      onStateChange('hidden');
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [onStateChange]);

  useEffect(() => {
    if (smartInputState === 'active') {
      // Keep panel minimal on open: no forced caret/hints.
      setIsFocused(false);
    }
    if (smartInputState === 'media' && !sheetOpen) {
      setSheetOpen(true);
    }
    if (smartInputState === 'recording' && !isRecording) {
      startRecording();
    } else if (smartInputState !== 'recording' && isRecording) {
      stopRecording();
    }
  }, [smartInputState, isRecording]);

  const handleSend = () => {
    if (!val.trim()) return;
    onSend(val);
    setVal('');
    setIsFocused(false);
  };


  const processFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImageSelect) return;

    logDiagnostic(`n8n-Input: Selected ${file.name} (${Math.round(file.size / 1024)} KB)`, 'info');
    setSheetOpen(false);

    let processedBlob: Blob | File = file;
    const isHEIC = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif') || file.type.includes('heic');

    if (isHEIC) {
      logDiagnostic('n8n-Input: HEIC detected, converting...', 'info');
      try {
        const result = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.7
        });
        processedBlob = Array.isArray(result) ? result[0] : (result as Blob);
        logDiagnostic(`n8n-Input: HEIC converted. New size: ${Math.round(processedBlob.size / 1024)} KB`, 'info');
      } catch (err: any) {
        logDiagnostic(`n8n ERROR (HEIC): ${err.message}`, 'error');
        showToast('❌ Ошибка HEIC - попробуйте JPEG');
        e.target.value = '';
        return; 
      }
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result;
        if (typeof base64 !== 'string') {
          throw new Error('Invalid format');
        }
        const compressed = await compressImage(base64, 1024); 
        // IMMEDIATE SEND - No preview step
        onImageSelect(compressed);
        triggerHaptic([15, 40, 15]);
        showToast("✨ Фото отправлено");
        onStateChange('active');
      } catch (err: any) {
        logDiagnostic(`n8n ERROR: ${err.message}`, 'error');
        showToast('❌ Ошибка: ' + err.message);
      }
    };
    reader.readAsDataURL(processedBlob);
    e.target.value = '';
  };

  const startRecording = async () => {
    try {
      disableVerticalSwipes();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        logDiagnostic('VOICE: Stop called. Processing...', 'info');
        const startedAt = recordingStartedAtRef.current;
        const duration = startedAt ? Date.now() - startedAt : 0;
        
        // Clean up immediately
        recordingStartedAtRef.current = null;
        if (recordingTimerRef.current) {
          window.clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        setIsRecording(false);

        if (duration < MIN_RECORDING_MS) {
          triggerHaptic([30, 40, 30]);
          showToast('⚠️ Короткая запись');
          stream.getTracks().forEach(track => track.stop());
          onStateChange('active');
          return;
        }

        try {
          const mimeType = recorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

          // IMMEDIATE SEND
          const result = await sendVoiceToN8N(
            audioBlob, user?.email || 'unknown', user?.uid || 'unknown',
            shoppingList, stock, diary, baseline
          );
          
          if (result) {
            result.source = 'voice';
          }

          if (onVoiceResponse) onVoiceResponse(result);
          triggerHaptic([12, 40, 12]);
          showToast('✨ Готово!');
        } catch (err: any) {
          showToast(`❌ Ошибка: ${err.message}`);
        }
        stream.getTracks().forEach(track => track.stop());
        onStateChange('active');
      };

      recorder.start();
      triggerHaptic(16);
      recordingStartedAtRef.current = Date.now();
      setIsRecording(true);
      showToast('🎙️ Слушаю...');
    } catch (err: any) {
      showToast('🎤 Ошибка микрофона');
    }
  };

  const stopRecording = () => {
    enableVerticalSwipes();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    // Final cleanup in stop handler
    onStateChange('active');
  };

  // ROBUST GESTURE: Catch finger release globally
  useEffect(() => {
    // We want to catch release if we are recording OR dragging
    const handleGlobalEnd = () => {
      if (isRecording) {
        stopRecording();
      }
      if (swipeStartX.current !== null) {
        setDragOffset(0);
        setActiveSide('none');
        swipeStartX.current = null;
      }
    };

    window.addEventListener('touchend', handleGlobalEnd);
    window.addEventListener('mouseup', handleGlobalEnd);
    
    return () => {
      window.removeEventListener('touchend', handleGlobalEnd);
      window.removeEventListener('mouseup', handleGlobalEnd);
    };
  }, [isRecording]);

  return (
    <div
      className="smart-input-wrap"
      ref={wrapperRef}
      style={{ bottom: keyboardOffset > 0 ? `${keyboardOffset + 10}px` : undefined }}
    >
      <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={processFile} />
      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} style={{ display: 'none' }} onChange={processFile} />

      <div
        className={`smart-input glass-panel ${isFocused ? 'focused' : ''} ${smartInputState === 'active' || smartInputState === 'media' ? 'visible' : 'hidden'} active-side-${activeSide}`}
        onTouchStart={(e) => {
          if (isRecording) return;
          const touch = e.touches[0];
          swipeStartX.current = touch.clientX;
        }}
        onTouchMove={(e) => {
          if (swipeStartX.current === null || isRecording) return;
          
          // Prevent browser gestures (like back navigation) while dragging the ball
          if (e.cancelable) e.preventDefault();
          
          const touch = e.touches[0];
          const deltaX = touch.clientX - swipeStartX.current;
          
          setDragOffset(deltaX);

          // Detect active side based on threshold
          if (deltaX < -GESTURE_COMMIT_THRESHOLD / 2) {
            if (activeSide !== 'left') {
              setActiveSide('left');
              triggerHaptic(10);
            }
          } else if (deltaX > GESTURE_COMMIT_THRESHOLD / 2) {
            if (activeSide !== 'right') {
              setActiveSide('right');
              triggerHaptic(10);
            }
          } else {
            setActiveSide('none');
          }
        }}
        onTouchEnd={() => {
          if (swipeStartX.current === null || isRecording) return;
          
          if (dragOffset < -GESTURE_COMMIT_THRESHOLD) {
            // Trigger Camera
            triggerHaptic([15, 30, 15]);
            cameraInputRef.current?.click();
            onStateChange('media');
          } else if (dragOffset > GESTURE_COMMIT_THRESHOLD) {
            // Trigger Mic
            triggerHaptic([15, 30, 15]);
            startRecording();
            onStateChange('recording');
          }

          // Reset
          setDragOffset(0);
          setActiveSide('none');
          swipeStartX.current = null;
        }}
        style={{
          transform: `translateX(${dragOffset * 0.4}px)`, // Parallax effect for the whole bar
          transition: swipeStartX.current === null ? 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'none'
        }}
      >
        <div className="si-controls">
          {!isRecording && (
            <button 
              className={`si-btn-icon si-left-icon ${activeSide === 'left' ? 'active' : ''}`}
              onClick={() => { triggerHaptic(15); cameraInputRef.current?.click(); onStateChange('media'); }}
            >
              📸
            </button>
          )}

          <div className="si-center-gesture">
            {!isRecording && (
              <input
                className="si-inp"
                ref={textInputRef}
                placeholder={placeholder || "Сообщение..."}
                value={val}
                onChange={e => setVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                onFocus={() => setIsFocused(true)}
              />
            )}
          </div>

          {!isRecording && (
            <button 
              className={`si-btn-icon si-right-icon ${activeSide === 'right' ? 'active' : ''}`}
              onClick={() => { triggerHaptic(15); startRecording(); onStateChange('recording'); }}
            >
              🎙️
            </button>
          )}
          
          {val.trim() && !isRecording && (
            <div className="si-quick-send">
               <button className="si-action-btn send-btn animated-pop" onClick={() => { triggerHaptic(15); handleSend(); }}>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                   <line x1="12" y1="19" x2="12" y2="5"></line>
                   <polyline points="5 12 12 5 19 12"></polyline>
                 </svg>
               </button>
            </div>
          )}
        </div>
      </div>

      <ActionSheet
        isOpen={sheetOpen}
        onClose={() => { setSheetOpen(false); onStateChange('active'); }}
        options={[
          { label: 'Сделать фото', onClick: () => { setSheetOpen(false); cameraInputRef.current?.click(); } },
          { label: 'Галерея', onClick: () => { setSheetOpen(false); fileInputRef.current?.click(); } }
        ]}
      />
    </div>
  );
};
