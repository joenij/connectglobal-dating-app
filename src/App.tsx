import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'react-native';
import { store } from './redux/store';
import AppNavigator from './navigation/AppNavigator';
import { AuthProvider } from './services/auth/AuthContext';
import { SecurityProvider } from './services/security/SecurityContext';
import { initializeApp } from './services/app/AppInitializer';

const App: React.FC = () => {
  useEffect(() => {
    // Initialize app services
    initializeApp();
  }, []);

  return (
    <Provider store={store}>
      <AuthProvider>
        <SecurityProvider>
          <NavigationContainer>
            <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
            <AppNavigator />
          </NavigationContainer>
        </SecurityProvider>
      </AuthProvider>
    </Provider>
  );
};

export default App;