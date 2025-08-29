import { configureStore } from '@reduxjs/toolkit';
import { combineReducers } from 'redux';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import reducers
import authReducer from './slices/authSlice';
import userReducer from './slices/userSlice';
import matchingReducer from './slices/matchingSlice';
import messagingReducer from './slices/messagingSlice';
import pricingReducer from './slices/pricingSlice';
import securityReducer from './slices/securitySlice';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'user'], // Only persist auth and user data
  blacklist: ['matching', 'messaging'], // Don't persist real-time data
};

const rootReducer = combineReducers({
  auth: authReducer,
  user: userReducer,
  matching: matchingReducer,
  messaging: messagingReducer,
  pricing: pricingReducer,
  security: securityReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
  devTools: __DEV__,
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;