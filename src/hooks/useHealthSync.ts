import { useState, useCallback } from 'react';
import { Health } from '@capgo/capacitor-health';
import { Capacitor } from '@capacitor/core';
import { showToast } from '../components/Toast';

export interface HealthData {
  steps: number;
  weight: number;
  calories: number;
  lastSync: number;
}

export function useHealthSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [healthData, setHealthData] = useState<HealthData | null>(() => {
    try {
      const saved = localStorage.getItem('health_sync_data');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error('Failed to parse health data:', e);
      return null;
    }
  });

  const requestPermissions = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      showToast('⚠️ Синхронизация доступна только на мобильных устройствах');
      return false;
    }

    try {
      const avail = await Health.isAvailable();
      if (!avail.available) {
        showToast('⚠️ Health Connect не установлен на этом устройстве');
        return false;
      }

      const status = await Health.requestAuthorization({
        read: ['steps', 'weight', 'totalCalories'],
        write: ['weight']
      });
      
      const isGranted = status.readAuthorized.includes('steps');
      if (isGranted) {
        showToast('✅ Доступ к данным здоровья разрешен');
      } else {
        showToast('⚠️ Разрешите доступ к Шагам в настройках Health Connect');
        if (Capacitor.getPlatform() === 'android') {
           Health.openHealthConnectSettings().catch(() => {});
        }
      }
      return isGranted;
    } catch (err: any) {
      console.error('Health authorization error:', err);
      // specific error from plugin or OS
      showToast(`❌ Ошибка: ${err?.message || 'Сбой запроса разрешений'}`);
      
      if (Capacitor.getPlatform() === 'android') {
         Health.openHealthConnectSettings().catch(() => {});
      }
      return false;
    }
  }, []);

  const syncData = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    
    setIsSyncing(true);
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const endOfTime = now.toISOString();
      
      // Use queryAggregated for steps and totalCalories
      const [stepsRes, caloriesRes, weightRes] = await Promise.all([
        Health.queryAggregated({ 
          dataType: 'steps', 
          startDate: startOfDay, 
          endDate: endOfTime,
          aggregation: 'sum',
          bucket: 'day'
        }),
        Health.queryAggregated({ 
          dataType: 'totalCalories', 
          startDate: startOfDay, 
          endDate: endOfTime,
          aggregation: 'sum',
          bucket: 'day'
        }),
        Health.readSamples({ 
          dataType: 'weight', 
          startDate: new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)).toISOString(), 
          endDate: endOfTime,
          limit: 1,
          ascending: false
        })
      ]);

      const newData: HealthData = {
        steps: stepsRes.samples[0]?.value || 0,
        calories: Math.round(caloriesRes.samples[0]?.value || 0),
        weight: weightRes.samples[0]?.value || (healthData?.weight || 0),
        lastSync: Date.now()
      };

      setHealthData(newData);
      localStorage.setItem('health_sync_data', JSON.stringify(newData));
      showToast('✅ Данные здоровья синхронизированы');
    } catch (err) {
      console.error('Health sync error:', err);
      showToast('❌ Ошибка синхронизации данных');
    } finally {
      setIsSyncing(false);
    }
  }, [healthData]);

  return {
    healthData,
    isSyncing,
    requestPermissions,
    syncData
  };
}
