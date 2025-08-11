import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface PricingTier {
  monthly: number;
  yearly: number;
  currency: string;
}

interface PricingModifier {
  type: string;
  name: string;
  discountPercentage: number;
  validUntil: string;
  message: string;
}

interface Subscription {
  id: string;
  userId: string;
  plan: 'free' | 'premium' | 'elite';
  status: 'active' | 'cancelled' | 'expired';
  startDate: string | null;
  endDate: string | null;
  autoRenew: boolean;
}

interface PricingState {
  countryCode: string;
  tier: number;
  pricing: {
    premium: PricingTier;
    elite: PricingTier;
  } | null;
  modifiers: PricingModifier[];
  subscription: Subscription | null;
  features: {
    free: string[];
    premium: string[];
    elite: string[];
  };
  isLoading: boolean;
  error: string | null;
}

const initialState: PricingState = {
  countryCode: 'US',
  tier: 1,
  pricing: null,
  modifiers: [],
  subscription: null,
  features: {
    free: [],
    premium: [],
    elite: [],
  },
  isLoading: false,
  error: null,
};

const pricingSlice = createSlice({
  name: 'pricing',
  initialState,
  reducers: {
    setPricing: (state, action: PayloadAction<{
      countryCode: string;
      tier: number;
      pricing: { premium: PricingTier; elite: PricingTier };
      features: { free: string[]; premium: string[]; elite: string[] };
    }>) => {
      const { countryCode, tier, pricing, features } = action.payload;
      state.countryCode = countryCode;
      state.tier = tier;
      state.pricing = pricing;
      state.features = features;
    },
    setModifiers: (state, action: PayloadAction<PricingModifier[]>) => {
      state.modifiers = action.payload;
    },
    setSubscription: (state, action: PayloadAction<Subscription>) => {
      state.subscription = action.payload;
    },
    updateSubscription: (state, action: PayloadAction<Partial<Subscription>>) => {
      if (state.subscription) {
        state.subscription = { ...state.subscription, ...action.payload };
      }
    },
    clearSubscription: (state) => {
      state.subscription = null;
    },
    setCountryCode: (state, action: PayloadAction<string>) => {
      state.countryCode = action.payload;
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
  setPricing,
  setModifiers,
  setSubscription,
  updateSubscription,
  clearSubscription,
  setCountryCode,
  setLoading,
  setError,
  clearError,
} = pricingSlice.actions;

export default pricingSlice.reducer;