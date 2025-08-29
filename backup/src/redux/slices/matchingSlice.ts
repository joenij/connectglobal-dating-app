import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Profile {
  id: number;
  name: string;
  age: number;
  location: string;
  distance: string;
  photos: string[];
  bio: string;
  interests: string[];
  languages: string[];
  verified: boolean;
  compatibilityScore?: number;
}

interface Match {
  id: string;
  matchedAt: string;
  user: {
    id: number;
    name: string;
    age: number;
    location: string;
    photo: string;
  };
  lastMessage?: {
    text: string;
    timestamp: string;
    unread: boolean;
  };
}

interface MatchingState {
  currentProfiles: Profile[];
  currentIndex: number;
  matches: Match[];
  isLoading: boolean;
  error: string | null;
}

const initialState: MatchingState = {
  currentProfiles: [],
  currentIndex: 0,
  matches: [],
  isLoading: false,
  error: null,
};

const matchingSlice = createSlice({
  name: 'matching',
  initialState,
  reducers: {
    setProfiles: (state, action: PayloadAction<Profile[]>) => {
      state.currentProfiles = action.payload;
      state.currentIndex = 0;
    },
    nextProfile: (state) => {
      if (state.currentIndex < state.currentProfiles.length - 1) {
        state.currentIndex += 1;
      }
    },
    addMatch: (state, action: PayloadAction<Match>) => {
      state.matches.unshift(action.payload);
    },
    setMatches: (state, action: PayloadAction<Match[]>) => {
      state.matches = action.payload;
    },
    recordAction: (state, action: PayloadAction<{ profileId: number; action: string }>) => {
      // Remove the profile that was acted upon
      const { profileId } = action.payload;
      state.currentProfiles = state.currentProfiles.filter(p => p.id !== profileId);
      
      // Adjust index if necessary
      if (state.currentIndex >= state.currentProfiles.length && state.currentProfiles.length > 0) {
        state.currentIndex = state.currentProfiles.length - 1;
      }
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
  setProfiles,
  nextProfile,
  addMatch,
  setMatches,
  recordAction,
  setLoading,
  setError,
  clearError,
} = matchingSlice.actions;

export default matchingSlice.reducer;