/**
 * @jest-environment jsdom
 */

describe('Hooks', () => {
  describe('useAccessibility', () => {
    test('hook module can be imported without errors', () => {
      expect(() => require('../hooks/useAccessibility')).not.toThrow();
    });

    test('hook returns expected interface', () => {
      const useAccessibility = require('../hooks/useAccessibility').useAccessibility;
      expect(useAccessibility).toBeDefined();
      expect(typeof useAccessibility).toBe('function');
    });

    test('hook has expected exports', () => {
      const module = require('../hooks/useAccessibility');
      expect(module.useAccessibility).toBeDefined();
      expect(module.AccessibleText).toBeDefined();
      expect(module.AccessibleButton).toBeDefined();
      expect(module.FocusRing).toBeDefined();
    });
  });

  describe('useAdvancedGestures', () => {
    test('hook module can be imported without errors', () => {
      expect(() => require('../hooks/useAdvancedGestures')).not.toThrow();
    });

    test('hook returns expected interface', () => {
      const useAdvancedGestures = require('../hooks/useAdvancedGestures').useAdvancedGestures;
      expect(useAdvancedGestures).toBeDefined();
      expect(typeof useAdvancedGestures).toBe('function');
    });
  });

  describe('usePerformanceOptimization', () => {
    test('hook module can be imported without errors', () => {
      expect(() => require('../hooks/usePerformanceOptimization')).not.toThrow();
    });

    test('hook returns expected interface', () => {
      const usePerformanceOptimization = require('../hooks/usePerformanceOptimization').usePerformanceOptimization;
      expect(usePerformanceOptimization).toBeDefined();
      expect(typeof usePerformanceOptimization).toBe('function');
    });

    test('hook has expected exports', () => {
      const module = require('../hooks/usePerformanceOptimization');
      expect(module.usePerformanceOptimization).toBeDefined();
      expect(module.withPerformanceMonitoring).toBeDefined();
    });
  });

  describe('Hook Integration', () => {
    test('all hooks can be imported together', () => {
      expect(() => {
        require('../hooks/useAccessibility');
        require('../hooks/useAdvancedGestures');
        require('../hooks/usePerformanceOptimization');
      }).not.toThrow();
    });

    test('hooks do not have conflicting exports', () => {
      const accessibility = require('../hooks/useAccessibility');
      const gestures = require('../hooks/useAdvancedGestures');
      const performance = require('../hooks/usePerformanceOptimization');
      
      expect(accessibility.useAccessibility).toBeDefined();
      expect(gestures.useAdvancedGestures).toBeDefined();
      expect(performance.usePerformanceOptimization).toBeDefined();
    });
  });
});
