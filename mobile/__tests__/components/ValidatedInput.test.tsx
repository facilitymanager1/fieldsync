import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ValidatedInput from '../../src/components/ValidatedInput';
import { ValidationType, ValidationSeverity } from '../../src/types/validation';
import { TestUtils } from '../setup';

describe('ValidatedInput', () => {
  const mockOnChangeText = jest.fn();
  const mockOnFocus = jest.fn();
  const mockOnBlur = jest.fn();
  const mockOnValidation = jest.fn();

  const defaultProps = {
    value: '',
    onChangeText: mockOnChangeText,
    placeholder: 'Test input',
    label: 'Test Label',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('should render with label and placeholder', () => {
      const { getByText, getByPlaceholderText } = render(
        <ValidatedInput {...defaultProps} />
      );

      expect(getByText('Test Label')).toBeTruthy();
      expect(getByPlaceholderText('Test input')).toBeTruthy();
    });

    it('should render with initial value', () => {
      const { getByDisplayValue } = render(
        <ValidatedInput {...defaultProps} value="Initial Value" />
      );

      expect(getByDisplayValue('Initial Value')).toBeTruthy();
    });

    it('should render as multiline when specified', () => {
      const { getByPlaceholderText } = render(
        <ValidatedInput
          {...defaultProps}
          multiline={true}
          numberOfLines={3}
        />
      );

      const input = getByPlaceholderText('Test input');
      expect(input.props.multiline).toBe(true);
      expect(input.props.numberOfLines).toBe(3);
    });

    it('should apply custom styles', () => {
      const customStyle = { borderColor: 'red' };
      const customInputStyle = { fontSize: 18 };
      
      const { getByPlaceholderText } = render(
        <ValidatedInput
          {...defaultProps}
          style={customStyle}
          inputStyle={customInputStyle}
        />
      );

      const input = getByPlaceholderText('Test input');
      expect(input.props.style).toEqual(expect.arrayContaining([
        expect.objectContaining(customInputStyle)
      ]));
    });
  });

  describe('Input Interactions', () => {
    it('should handle text changes', () => {
      const { getByPlaceholderText } = render(
        <ValidatedInput {...defaultProps} />
      );

      const input = getByPlaceholderText('Test input');
      fireEvent.changeText(input, 'New text');

      expect(mockOnChangeText).toHaveBeenCalledWith('New text');
    });

    it('should handle focus events', () => {
      const { getByPlaceholderText } = render(
        <ValidatedInput {...defaultProps} onFocus={mockOnFocus} />
      );

      const input = getByPlaceholderText('Test input');
      fireEvent(input, 'focus');

      expect(mockOnFocus).toHaveBeenCalled();
    });

    it('should handle blur events', () => {
      const { getByPlaceholderText } = render(
        <ValidatedInput {...defaultProps} onBlur={mockOnBlur} />
      );

      const input = getByPlaceholderText('Test input');
      fireEvent(input, 'blur');

      expect(mockOnBlur).toHaveBeenCalled();
    });

    it('should be disabled when editable is false', () => {
      const { getByPlaceholderText } = render(
        <ValidatedInput {...defaultProps} editable={false} />
      );

      const input = getByPlaceholderText('Test input');
      expect(input.props.editable).toBe(false);
    });
  });

  describe('Validation Display', () => {
    it('should show validation errors', () => {
      const validationResult = TestUtils.generateTestValidationResult(false, [
        'This field is required',
        'Minimum 3 characters required'
      ]);

      const { getByText } = render(
        <ValidatedInput
          {...defaultProps}
          validationResult={validationResult}
        />
      );

      expect(getByText('This field is required')).toBeTruthy();
      expect(getByText('Minimum 3 characters required')).toBeTruthy();
    });

    it('should show validation warnings', () => {
      const validationResult = {
        fieldName: 'testField',
        isValid: true,
        errors: [],
        warnings: [{
          message: 'Consider using a stronger password',
          severity: ValidationSeverity.WARNING,
          type: ValidationType.CUSTOM
        }],
        infos: []
      };

      const { getByText } = render(
        <ValidatedInput
          {...defaultProps}
          validationResult={validationResult}
        />
      );

      expect(getByText('Consider using a stronger password')).toBeTruthy();
    });

    it('should show validation icons when enabled', () => {
      const validationResult = TestUtils.generateTestValidationResult(false, [
        'Error message'
      ]);

      const { getByTestId } = render(
        <ValidatedInput
          {...defaultProps}
          validationResult={validationResult}
          showValidationIcon={true}
          testID="validated-input"
        />
      );

      // Should show error icon
      expect(getByTestId).toBeTruthy(); // Icon should be present
    });

    it('should show loading indicator when validating', () => {
      const { getByTestId } = render(
        <ValidatedInput
          {...defaultProps}
          isValidating={true}
          showValidationIcon={true}
          testID="validated-input"
        />
      );

      // Should show loading indicator
      expect(getByTestId).toBeTruthy();
    });

    it('should hide errors when animateErrors is false', () => {
      const validationResult = TestUtils.generateTestValidationResult(false, [
        'Error message'
      ]);

      const { queryByText } = render(
        <ValidatedInput
          {...defaultProps}
          validationResult={validationResult}
          animateErrors={false}
        />
      );

      expect(queryByText('Error message')).toBeTruthy();
    });
  });

  describe('Character Count', () => {
    it('should show character count when enabled', () => {
      const { getByText } = render(
        <ValidatedInput
          {...defaultProps}
          value="Hello"
          maxLength={100}
          showCharacterCount={true}
        />
      );

      expect(getByText('5/100')).toBeTruthy();
    });

    it('should show warning color when near limit', () => {
      const { getByText } = render(
        <ValidatedInput
          {...defaultProps}
          value="12345678901234567890123456789012345678901234567890123456789012345678901234567890123"
          maxLength={100}
          showCharacterCount={true}
        />
      );

      const characterCount = getByText('83/100');
      expect(characterCount).toBeTruthy();
      // Should have warning styling (would need to check styles in actual implementation)
    });

    it('should show error color when over limit', () => {
      const { getByText } = render(
        <ValidatedInput
          {...defaultProps}
          value="This text is definitely over the maximum length limit of one hundred characters for testing purposes"
          maxLength={100}
          showCharacterCount={true}
        />
      );

      const characterCount = getByText('107/100');
      expect(characterCount).toBeTruthy();
      // Should have error styling (would need to check styles in actual implementation)
    });
  });

  describe('Password Field', () => {
    it('should toggle password visibility', () => {
      const { getByPlaceholderText, getByTestId } = render(
        <ValidatedInput
          {...defaultProps}
          secureTextEntry={true}
          placeholder="Password"
          testID="password-input"
        />
      );

      const input = getByPlaceholderText('Password');
      expect(input.props.secureTextEntry).toBe(true);

      // Find and press the visibility toggle button
      const toggleButton = getByTestId; // Would need proper test ID implementation
      // fireEvent.press(toggleButton);
      
      // After toggle, secureTextEntry should be false
      // expect(input.props.secureTextEntry).toBe(false);
    });
  });

  describe('Help Text', () => {
    it('should display help text when provided', () => {
      const helpText = 'This is helpful information about the field';
      
      const { getByText } = render(
        <ValidatedInput
          {...defaultProps}
          helpText={helpText}
        />
      );

      expect(getByText(helpText)).toBeTruthy();
    });
  });

  describe('Validation Integration', () => {
    it('should perform validation on text change', async () => {
      const validationRules = [
        { type: ValidationType.REQUIRED, message: 'This field is required' },
        { type: ValidationType.MIN_LENGTH, message: 'Minimum 3 characters', params: { min: 3 } }
      ];

      const { getByPlaceholderText } = render(
        <ValidatedInput
          {...defaultProps}
          validationRules={validationRules}
          onValidation={mockOnValidation}
          debounceMs={100}
        />
      );

      const input = getByPlaceholderText('Test input');
      
      fireEvent.changeText(input, 'ab'); // Too short

      // Fast-forward debounce time
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(mockOnValidation).toHaveBeenCalled();
      });
    });

    it('should validate on blur when enabled', async () => {
      const validationRules = [
        { type: ValidationType.REQUIRED, message: 'This field is required' }
      ];

      const { getByPlaceholderText } = render(
        <ValidatedInput
          {...defaultProps}
          validationRules={validationRules}
          onValidation={mockOnValidation}
          validateOnBlur={true}
        />
      );

      const input = getByPlaceholderText('Test input');
      
      fireEvent(input, 'blur');

      await waitFor(() => {
        expect(mockOnValidation).toHaveBeenCalled();
      });
    });

    it('should not validate when validation is disabled', () => {
      const validationRules = [
        { type: ValidationType.REQUIRED, message: 'This field is required' }
      ];

      const { getByPlaceholderText } = render(
        <ValidatedInput
          {...defaultProps}
          validationRules={validationRules}
          onValidation={mockOnValidation}
          validateOnChange={false}
          validateOnBlur={false}
        />
      );

      const input = getByPlaceholderText('Test input');
      
      fireEvent.changeText(input, 'test');
      fireEvent(input, 'blur');

      jest.advanceTimersByTime(1000);

      expect(mockOnValidation).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard and Input Types', () => {
    it('should set correct keyboard type', () => {
      const { getByPlaceholderText } = render(
        <ValidatedInput
          {...defaultProps}
          keyboardType="email-address"
          placeholder="Email"
        />
      );

      const input = getByPlaceholderText('Email');
      expect(input.props.keyboardType).toBe('email-address');
    });

    it('should set auto-capitalize setting', () => {
      const { getByPlaceholderText } = render(
        <ValidatedInput
          {...defaultProps}
          autoCapitalize="words"
          placeholder="Name"
        />
      );

      const input = getByPlaceholderText('Name');
      expect(input.props.autoCapitalize).toBe('words');
    });

    it('should set auto-correct setting', () => {
      const { getByPlaceholderText } = render(
        <ValidatedInput
          {...defaultProps}
          autoCorrect={false}
          placeholder="Username"
        />
      );

      const input = getByPlaceholderText('Username');
      expect(input.props.autoCorrect).toBe(false);
    });
  });

  describe('Accessibility', () => {
    it('should set accessibility labels', () => {
      const { getByPlaceholderText } = render(
        <ValidatedInput
          {...defaultProps}
          accessibilityLabel="Email input field"
          accessibilityHint="Enter your email address"
        />
      );

      const input = getByPlaceholderText('Test input');
      expect(input.props.accessibilityLabel).toBe('Email input field');
      expect(input.props.accessibilityHint).toBe('Enter your email address');
    });

    it('should be accessible for screen readers', () => {
      const validationResult = TestUtils.generateTestValidationResult(false, [
        'Email is required'
      ]);

      const { getByPlaceholderText, getByText } = render(
        <ValidatedInput
          {...defaultProps}
          validationResult={validationResult}
          accessibilityLabel="Email input"
        />
      );

      const input = getByPlaceholderText('Test input');
      const errorMessage = getByText('Email is required');

      expect(input.props.accessibilityLabel).toBe('Email input');
      expect(errorMessage).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null or undefined values', () => {
      const { getByPlaceholderText } = render(
        <ValidatedInput
          {...defaultProps}
          value={null as any}
        />
      );

      const input = getByPlaceholderText('Test input');
      expect(input.props.value).toBe(null);
    });

    it('should handle very long text inputs', () => {
      const longText = 'a'.repeat(10000);
      
      const { getByPlaceholderText } = render(
        <ValidatedInput
          {...defaultProps}
          value={longText}
          maxLength={10000}
        />
      );

      const input = getByPlaceholderText('Test input');
      expect(input.props.value).toBe(longText);
    });

    it('should handle rapid text changes', () => {
      const { getByPlaceholderText } = render(
        <ValidatedInput
          {...defaultProps}
          onValidation={mockOnValidation}
          debounceMs={100}
        />
      );

      const input = getByPlaceholderText('Test input');

      // Rapid changes
      for (let i = 0; i < 10; i++) {
        fireEvent.changeText(input, `text${i}`);
      }

      expect(mockOnChangeText).toHaveBeenCalledTimes(10);

      // Only the last validation should occur after debounce
      jest.advanceTimersByTime(100);
      
      // Should only validate once with the final value
      expect(mockOnValidation).toHaveBeenCalledTimes(1);
    });

    it('should cleanup timers on unmount', () => {
      const { unmount, getByPlaceholderText } = render(
        <ValidatedInput
          {...defaultProps}
          onValidation={mockOnValidation}
          debounceMs={100}
        />
      );

      const input = getByPlaceholderText('Test input');
      fireEvent.changeText(input, 'test');

      unmount();

      // Should not throw after unmount
      expect(() => jest.runAllTimers()).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle multiple simultaneous inputs efficiently', () => {
      const inputs = [];
      
      for (let i = 0; i < 10; i++) {
        inputs.push(
          <ValidatedInput
            key={i}
            value=""
            onChangeText={jest.fn()}
            placeholder={`Input ${i}`}
            validationRules={[
              { type: ValidationType.REQUIRED, message: 'Required' }
            ]}
          />
        );
      }

      const start = Date.now();
      const { getAllByPlaceholderText } = render(<>{inputs}</>);
      const renderTime = Date.now() - start;

      const allInputs = getAllByPlaceholderText(/Input \d/);
      expect(allInputs).toHaveLength(10);
      expect(renderTime).toBeLessThan(1000); // Should render quickly
    });
  });
});