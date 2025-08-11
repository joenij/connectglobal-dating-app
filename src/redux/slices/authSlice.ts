import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

interface User {
  id: string;
  email: string;
  phoneNumber: string;
  isVerified: boolean;
  subscriptionTier: 'free' | 'premium' | 'elite';
  createdAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  mfaRequired: boolean;
  verificationStep: 'phone' | 'email' | 'video' | 'completed' | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  mfaRequired: false,
  verificationStep: null,
};

// Async actions
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials: { email: string; password: string }) => {
    // API call logic will be implemented here
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    return response.json();
  }
);

export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async (userData: {
    email: string;
    phoneNumber: string;
    password: string;
    countryCode: string;
  }) => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    return response.json();
  }
);

export const verifyPhone = createAsyncThunk(
  'auth/verifyPhone',
  async (verificationData: { phoneNumber: string; code: string }) => {
    const response = await fetch('/api/auth/verify-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(verificationData),
    });
    return response.json();
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.verificationStep = null;
      state.error = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    setVerificationStep: (state, action: PayloadAction<AuthState['verificationStep']>) => {
      state.verificationStep = action.payload;
    },
    enableMFA: (state) => {
      state.mfaRequired = true;
    },
    disableMFA: (state) => {
      state.mfaRequired = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login cases
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.mfaRequired = action.payload.mfaRequired || false;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Login failed';
      })
      // Register cases
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.verificationStep = 'phone';
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Registration failed';
      })
      // Phone verification cases
      .addCase(verifyPhone.fulfilled, (state, action) => {
        state.verificationStep = 'email';
        if (state.user) {
          state.user.isVerified = action.payload.verified;
        }
      });
  },
});

export const { logout, clearError, setVerificationStep, enableMFA, disableMFA } = authSlice.actions;
export default authSlice.reducer;