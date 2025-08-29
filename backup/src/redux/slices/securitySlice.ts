import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SecurityEvent {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  riskLevel: 'low' | 'medium' | 'high';
  resolved: boolean;
}

interface SecuritySettings {
  biometricEnabled: boolean;
  twoFactorEnabled: boolean;
  locationTracking: boolean;
  dataSharing: boolean;
  profileVisibility: 'public' | 'friends' | 'private';
}

interface SecurityState {
  events: SecurityEvent[];
  settings: SecuritySettings;
  riskScore: number;
  isSecurityCheckRequired: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: SecurityState = {
  events: [],
  settings: {
    biometricEnabled: false,
    twoFactorEnabled: false,
    locationTracking: true,
    dataSharing: false,
    profileVisibility: 'public',
  },
  riskScore: 0,
  isSecurityCheckRequired: false,
  isLoading: false,
  error: null,
};

const securitySlice = createSlice({
  name: 'security',
  initialState,
  reducers: {
    addSecurityEvent: (state, action: PayloadAction<SecurityEvent>) => {
      state.events.unshift(action.payload);
      
      // Update risk score based on event
      if (action.payload.riskLevel === 'high') {
        state.riskScore += 30;
      } else if (action.payload.riskLevel === 'medium') {
        state.riskScore += 15;
      } else {
        state.riskScore += 5;
      }
      
      // Cap risk score at 100
      state.riskScore = Math.min(state.riskScore, 100);
      
      // Require security check if risk score is high
      if (state.riskScore >= 70) {
        state.isSecurityCheckRequired = true;
      }
    },
    resolveSecurityEvent: (state, action: PayloadAction<string>) => {
      const eventIndex = state.events.findIndex(e => e.id === action.payload);
      if (eventIndex >= 0) {
        state.events[eventIndex].resolved = true;
        
        // Reduce risk score when events are resolved
        const event = state.events[eventIndex];
        if (event.riskLevel === 'high') {
          state.riskScore -= 20;
        } else if (event.riskLevel === 'medium') {
          state.riskScore -= 10;
        } else {
          state.riskScore -= 3;
        }
        
        state.riskScore = Math.max(state.riskScore, 0);
        
        // Remove security check requirement if risk is low
        if (state.riskScore < 30) {
          state.isSecurityCheckRequired = false;
        }
      }
    },
    updateSecuritySettings: (state, action: PayloadAction<Partial<SecuritySettings>>) => {
      state.settings = { ...state.settings, ...action.payload };
    },
    setRiskScore: (state, action: PayloadAction<number>) => {
      state.riskScore = Math.max(0, Math.min(100, action.payload));
    },
    setSecurityCheckRequired: (state, action: PayloadAction<boolean>) => {
      state.isSecurityCheckRequired = action.payload;
    },
    clearSecurityEvents: (state) => {
      state.events = [];
      state.riskScore = 0;
      state.isSecurityCheckRequired = false;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  addSecurityEvent,
  resolveSecurityEvent,
  updateSecuritySettings,
  setRiskScore,
  setSecurityCheckRequired,
  clearSecurityEvents,
  setLoading,
  setError,
  clearError,
} = securitySlice.actions;

export default securitySlice.reducer;