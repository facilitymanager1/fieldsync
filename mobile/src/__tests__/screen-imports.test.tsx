/**
 * @jest-environment jsdom
 */

describe('Screen Components', () => {
  describe('Onboarding Screens', () => {
    test('WelcomeScreen can be imported without errors', () => {
      expect(() => require('../screens/onboarding/WelcomeScreen')).not.toThrow();
    });

    test('PersonalInfoScreen can be imported without errors', () => {
      expect(() => require('../screens/onboarding/PersonalInfoScreen')).not.toThrow();
    });

    test('CompanyInfoScreen can be imported without errors', () => {
      expect(() => require('../screens/onboarding/CompanyInfoScreen')).not.toThrow();
    });

    test('PermissionsScreen can be imported without errors', () => {
      expect(() => require('../screens/onboarding/PermissionsScreen')).not.toThrow();
    });

    test('NotificationsScreen can be imported without errors', () => {
      expect(() => require('../screens/onboarding/NotificationsScreen')).not.toThrow();
    });

    test('CompletionScreen can be imported without errors', () => {
      expect(() => require('../screens/onboarding/CompletionScreen')).not.toThrow();
    });

    test('IntroductionScreen can be imported without errors', () => {
      expect(() => require('../screens/onboarding/IntroductionScreen')).not.toThrow();
    });

    test('FeatureHighlightsScreen can be imported without errors', () => {
      expect(() => require('../screens/onboarding/FeatureHighlightsScreen')).not.toThrow();
    });

    test('GettingStartedScreen can be imported without errors', () => {
      expect(() => require('../screens/onboarding/GettingStartedScreen')).not.toThrow();
    });

    test('ProfileSetupScreen can be imported without errors', () => {
      expect(() => require('../screens/onboarding/ProfileSetupScreen')).not.toThrow();
    });
  });

  describe('Screen Module Validation', () => {
    test('all onboarding screens have default exports', () => {
      const screens = [
        '../screens/onboarding/WelcomeScreen',
        '../screens/onboarding/PersonalInfoScreen',
        '../screens/onboarding/CompanyInfoScreen',
        '../screens/onboarding/PermissionsScreen',
        '../screens/onboarding/NotificationsScreen',
        '../screens/onboarding/CompletionScreen',
        '../screens/onboarding/IntroductionScreen',
        '../screens/onboarding/FeatureHighlightsScreen',
        '../screens/onboarding/GettingStartedScreen',
        '../screens/onboarding/ProfileSetupScreen',
      ];

      screens.forEach(screenPath => {
        const screenModule = require(screenPath);
        expect(screenModule.default).toBeDefined();
        expect(typeof screenModule.default).toBe('function');
      });
    });

    test('screens have proper component structure', () => {
      const WelcomeScreen = require('../screens/onboarding/WelcomeScreen').default;
      const PersonalInfoScreen = require('../screens/onboarding/PersonalInfoScreen').default;
      
      // Check that they are React components (functions or classes)
      expect(typeof WelcomeScreen).toBe('function');
      expect(typeof PersonalInfoScreen).toBe('function');
    });
  });

  describe('Component Dependencies', () => {
    test('screens can access required UI components', () => {
      // Test that the components used by screens are available
      expect(() => require('../components/ui/Button')).not.toThrow();
      expect(() => require('../components/ui/Input')).not.toThrow();
      expect(() => require('../components/ui/Card')).not.toThrow();
      expect(() => require('../components/ui/ProgressHeader')).not.toThrow();
      expect(() => require('../components/ui/OfflineIndicator')).not.toThrow();
    });

    test('screens can access required contexts', () => {
      // Test that the contexts used by screens are available
      expect(() => require('../contexts/OnboardingContext')).not.toThrow();
    });

    test('screens can access required hooks', () => {
      // Test that the hooks used by screens are available
      expect(() => require('../hooks/useAccessibility')).not.toThrow();
      expect(() => require('../hooks/useAdvancedGestures')).not.toThrow();
      expect(() => require('../hooks/usePerformanceOptimization')).not.toThrow();
    });
  });
});
