import React, { createContext, useContext, ReactNode } from 'react';

interface SecurityContextType {
  // Add security-specific context methods here
  checkBiometric: () => Promise<boolean>;
  enableTwoFactor: () => Promise<void>;
  reportUser: (userId: string, reason: string) => Promise<void>;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (context === undefined) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
};

interface SecurityProviderProps {
  children: ReactNode;
}

export const SecurityProvider: React.FC<SecurityProviderProps> = ({ children }) => {
  const checkBiometric = async (): Promise<boolean> => {
    // Implementation would go here
    console.log('Checking biometric');
    return false;
  };

  const enableTwoFactor = async () => {
    // Implementation would go here
    console.log('Enabling 2FA');
  };

  const reportUser = async (userId: string, reason: string) => {
    // Implementation would go here
    console.log('Reporting user:', userId, reason);
  };

  const value = {
    checkBiometric,
    enableTwoFactor,
    reportUser,
  };

  return <SecurityContext.Provider value={value}>{children}</SecurityContext.Provider>;
};