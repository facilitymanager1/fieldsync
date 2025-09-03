declare module '@components/ui/Button' {
  import { TouchableOpacityProps } from 'react-native';
  
  interface ButtonProps extends TouchableOpacityProps {
    title: string;
    variant?: 'primary' | 'secondary' | 'outline';
    size?: 'small' | 'medium' | 'large';
    disabled?: boolean;
    loading?: boolean;
    onPress?: () => void;
  }
  
  const Button: React.FC<ButtonProps>;
  export default Button;
}

declare module '@components/ui/Input' {
  import { TextInputProps } from 'react-native';
  
  interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    variant?: 'default' | 'outlined' | 'filled';
    size?: 'small' | 'medium' | 'large';
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
  }
  
  const Input: React.FC<InputProps>;
  export default Input;
}

declare module '@components/ui/Card' {
  import { ViewProps } from 'react-native';
  
  interface CardProps extends ViewProps {
    children: React.ReactNode;
    variant?: 'default' | 'elevated' | 'outlined';
    padding?: number | string;
    margin?: number | string;
  }
  
  const Card: React.FC<CardProps>;
  export default Card;
}
