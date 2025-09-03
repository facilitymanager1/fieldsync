"use client";
import React from 'react';
import {
  IconButton,
  Tooltip,
  useTheme as useMuiTheme,
  Zoom,
} from '@mui/material';
import {
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  Brightness4 as AutoModeIcon,
} from '@mui/icons-material';
import { useTheme } from './ThemeProvider';

interface ThemeToggleProps {
  size?: 'small' | 'medium' | 'large';
  variant?: 'simple' | 'detailed';
  showTooltip?: boolean;
}

export default function ThemeToggle({ 
  size = 'medium', 
  variant = 'simple',
  showTooltip = true 
}: ThemeToggleProps) {
  const { mode, toggleColorMode } = useTheme();
  const muiTheme = useMuiTheme();

  const getIcon = () => {
    if (variant === 'detailed') {
      // Cycle through: light -> dark -> auto -> light
      return mode === 'light' ? <LightModeIcon /> : <DarkModeIcon />;
    }
    
    // Simple toggle between light and dark
    return mode === 'light' ? <LightModeIcon /> : <DarkModeIcon />;
  };

  const getTooltipText = () => {
    if (mode === 'light') {
      return 'Switch to dark mode';
    }
    return 'Switch to light mode';
  };

  const iconButton = (
    <IconButton
      onClick={toggleColorMode}
      size={size}
      sx={{
        color: 'inherit',
        transition: 'all 0.3s ease',
        '&:hover': {
          backgroundColor: muiTheme.palette.action.hover,
          transform: 'rotate(180deg)',
        },
      }}
      aria-label={getTooltipText()}
    >
      <Zoom in={true} timeout={300}>
        {getIcon()}
      </Zoom>
    </IconButton>
  );

  if (!showTooltip) {
    return iconButton;
  }

  return (
    <Tooltip title={getTooltipText()} placement="bottom">
      {iconButton}
    </Tooltip>
  );
}

// Advanced Theme Toggle with Menu
export function AdvancedThemeToggle() {
  const { mode, setColorMode } = useTheme();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleModeSelect = (newMode: 'light' | 'dark') => {
    setColorMode(newMode);
    handleClose();
  };

  return (
    <>
      <Tooltip title="Theme settings">
        <IconButton
          onClick={handleClick}
          size="medium"
          aria-label="theme settings"
          aria-controls={open ? 'theme-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
        >
          {mode === 'light' ? <LightModeIcon /> : <DarkModeIcon />}
        </IconButton>
      </Tooltip>
      
      {/* Menu implementation would go here */}
    </>
  );
}