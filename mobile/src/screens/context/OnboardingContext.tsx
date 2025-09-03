/**
 * OnboardingContext - Manages onboarding state and navigation
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface OnboardingState {
  currentStep: number;
  totalSteps: number;
  completedSteps: string[];
  canGoBack: boolean;
  canGoNext: boolean;
}

export interface OnboardingContextType {
  state: OnboardingState;
  goToStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  markStepCompleted: (stepId: string) => void;
  isStepCompleted: (stepId: string) => boolean;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export interface OnboardingProviderProps {
  children: ReactNode;
  totalSteps?: number;
  initialStep?: number;
}

export function OnboardingProvider({ 
  children, 
  totalSteps = 15, 
  initialStep = 1 
}: OnboardingProviderProps) {
  const [state, setState] = useState<OnboardingState>({
    currentStep: initialStep,
    totalSteps,
    completedSteps: [],
    canGoBack: initialStep > 1,
    canGoNext: true,
  });

  const goToStep = (step: number) => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(1, Math.min(step, totalSteps)),
      canGoBack: step > 1,
      canGoNext: step < totalSteps,
    }));
  };

  const nextStep = () => {
    goToStep(state.currentStep + 1);
  };

  const previousStep = () => {
    goToStep(state.currentStep - 1);
  };

  const markStepCompleted = (stepId: string) => {
    setState(prev => ({
      ...prev,
      completedSteps: [...prev.completedSteps.filter(id => id !== stepId), stepId],
    }));
  };

  const isStepCompleted = (stepId: string) => {
    return state.completedSteps.includes(stepId);
  };

  const value: OnboardingContextType = {
    state,
    goToStep,
    nextStep,
    previousStep,
    markStepCompleted,
    isStepCompleted,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
