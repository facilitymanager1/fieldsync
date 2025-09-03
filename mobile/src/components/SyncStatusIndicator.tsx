import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useOfflineSync } from '../hooks/useOfflineSync';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface SyncStatusIndicatorProps {
  position?: 'top' | 'bottom';
  showDetails?: boolean;
  onPress?: () => void;
  style?: any;
}

const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  position = 'top',
  showDetails = false,
  onPress,
  style,
}) => {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    conflictCount,
    error,
    lastSyncTime,
    startSync,
    retryFailedSync
  } = useOfflineSync();

  const [animatedValue] = React.useState(new Animated.Value(0));
  const [showError, setShowError] = React.useState(false);

  React.useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  React.useEffect(() => {
    if (error) {
      setShowError(true);
      const timer = setTimeout(() => setShowError(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const getStatusIcon = () => {
    if (isSyncing) return 'sync';
    if (!isOnline) return 'cloud-off';
    if (conflictCount > 0) return 'warning';
    if (pendingCount > 0) return 'cloud-upload';
    return 'cloud-done';
  };

  const getStatusColor = () => {
    if (showError || error) return '#FF5252';
    if (!isOnline) return '#FF9800';
    if (conflictCount > 0) return '#FF9800';
    if (pendingCount > 0) return '#2196F3';
    return '#4CAF50';
  };

  const getStatusText = () => {
    if (showError || error) return 'Sync Error';
    if (isSyncing) return 'Syncing...';
    if (!isOnline) return 'Offline';
    if (conflictCount > 0) return `${conflictCount} Conflict${conflictCount > 1 ? 's' : ''}`;
    if (pendingCount > 0) return `${pendingCount} Pending`;
    return 'Synced';
  };

  const handlePress = async () => {
    if (onPress) {
      onPress();
      return;
    }

    try {
      if (error || conflictCount > 0) {
        await retryFailedSync();
      } else if (pendingCount > 0 && isOnline) {
        await startSync();
      }
    } catch (err) {
      console.error('Sync action failed:', err);
    }
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - lastSyncTime.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        position === 'bottom' ? styles.bottom : styles.top,
        { opacity: animatedValue },
        style,
      ]}
    >
      <TouchableOpacity
        style={[styles.indicator, { borderLeftColor: getStatusColor() }]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          {isSyncing ? (
            <ActivityIndicator size="small" color={getStatusColor()} />
          ) : (
            <Icon name={getStatusIcon()} size={20} color={getStatusColor()} />
          )}
        </View>
        
        <View style={styles.textContainer}>
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
          
          {showDetails && (
            <Text style={styles.detailText}>
              Last sync: {formatLastSync()}
            </Text>
          )}
        </View>

        {(error || conflictCount > 0 || pendingCount > 0) && (
          <View style={styles.actionContainer}>
            <Icon name="refresh" size={16} color="#666" />
          </View>
        )}
      </TouchableOpacity>

      {showError && error && (
        <Animated.View style={styles.errorBanner}>
          <Icon name="error" size={16} color="#FFFFFF" />
          <Text style={styles.errorText} numberOfLines={2}>
            {error}
          </Text>
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={() => setShowError(false)}
          >
            <Icon name="close" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 16,
  },
  top: {
    top: 0,
  },
  bottom: {
    bottom: 0,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 4,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    marginRight: 8,
    width: 24,
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  detailText: {
    fontSize: 12,
    color: '#666',
  },
  actionContainer: {
    marginLeft: 8,
    padding: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF5252',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  errorText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    marginHorizontal: 8,
  },
  dismissButton: {
    padding: 4,
  },
});

export default SyncStatusIndicator;