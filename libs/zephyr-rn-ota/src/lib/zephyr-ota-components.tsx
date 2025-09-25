import React from 'react';
import {
  Alert,
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import type { ZephyrOTAUpdate } from './zephyr-ota-worker';

export interface ZephyrOTAModalProps {
  /** Available update information */
  update: ZephyrOTAUpdate | null;
  /** Whether the update is being applied */
  isApplying: boolean;
  /** Whether to show the modal */
  visible: boolean;
  /** Called when user accepts the update */
  onAccept: () => void;
  /** Called when user declines the update */
  onDecline: () => void;
  /** Called when user wants to be reminded later */
  onLater?: () => void;
  /** Custom styles */
  style?: {
    modal?: any;
    container?: any;
    title?: any;
    description?: any;
    button?: any;
    buttonText?: any;
  };
}

export function ZephyrOTAModal({
  update,
  isApplying,
  visible,
  onAccept,
  onDecline,
  onLater,
  style = {},
}: ZephyrOTAModalProps) {
  if (!update || !visible) return null;

  const showAlert = () => {
    Alert.alert(
      'Update Available',
      `Version ${update.version} is now available.\n\n${update.description || 'This update includes bug fixes and improvements.'}`,
      [
        { text: 'Later', onPress: onLater || onDecline, style: 'cancel' },
        { text: 'Skip', onPress: onDecline, style: 'destructive' },
        { text: 'Update', onPress: onAccept },
      ]
    );
  };

  // For critical updates, use native alert
  if (update.critical) {
    React.useEffect(() => {
      if (visible) showAlert();
    }, [visible]);
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      style={[styles.modal, style.modal]}
    >
      <View style={[styles.overlay, style.container]}>
        <View style={[styles.container, style.container]}>
          {isApplying ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={[styles.loadingText, style.title]}>
                Applying Update...
              </Text>
              <Text style={[styles.description, style.description]}>
                Please wait while the update is being applied.
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.title, style.title]}>Update Available</Text>

              <ScrollView style={styles.content}>
                <Text style={[styles.version, style.description]}>
                  Version {update.version}
                </Text>

                {update.description && (
                  <Text style={[styles.description, style.description]}>
                    {update.description}
                  </Text>
                )}
              </ScrollView>

              <View style={styles.buttonContainer}>
                {onLater && (
                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.secondaryButton,
                      style.button,
                    ]}
                    onPress={onLater}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        styles.secondaryButtonText,
                        style.buttonText,
                      ]}
                    >
                      Later
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton, style.button]}
                  onPress={onDecline}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      styles.secondaryButtonText,
                      style.buttonText,
                    ]}
                  >
                    Skip
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.primaryButton, style.button]}
                  onPress={onAccept}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      styles.primaryButtonText,
                      style.buttonText,
                    ]}
                  >
                    Update
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

export interface ZephyrOTABannerProps {
  /** Available update information */
  update: ZephyrOTAUpdate | null;
  /** Whether to show the banner */
  visible: boolean;
  /** Called when user taps the banner */
  onPress: () => void;
  /** Called when user dismisses the banner */
  onDismiss?: () => void;
  /** Custom styles */
  style?: {
    container?: any;
    text?: any;
    button?: any;
  };
}

export function ZephyrOTABanner({
  update,
  visible,
  onPress,
  onDismiss,
  style = {},
}: ZephyrOTABannerProps) {
  if (!update || !visible) return null;

  return (
    <View style={[styles.banner, style.container]}>
      <TouchableOpacity
        style={styles.bannerContent}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.bannerTextContainer}>
          <Text style={[styles.bannerTitle, style.text]}>Update Available</Text>
          <Text style={[styles.bannerDescription, style.text]}>
            Version {update.version} • Tap to update
          </Text>
        </View>

        {onDismiss && (
          <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
            <Text style={styles.dismissButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </View>
  );
}

export interface ZephyrOTAProviderProps {
  /** Application UID */
  applicationUid: string;
  /** OTA configuration options */
  config?: {
    checkInterval?: number;
    debug?: boolean;
    otaEndpoint?: string;
  };
  /** Custom modal styles */
  modalStyle?: ZephyrOTAModalProps['style'];
  /** Custom banner styles */
  bannerStyle?: ZephyrOTABannerProps['style'];
  /** Whether to show banner instead of modal for non-critical updates */
  useBanner?: boolean;
  /** Children components */
  children: React.ReactNode;
}

/** Complete OTA provider that handles everything automatically */
export function ZephyrOTAProvider({
  applicationUid,
  config = {},
  modalStyle,
  bannerStyle,
  useBanner = false,
  children,
}: ZephyrOTAProviderProps) {
  // This would use the useZephyrOTA hook we created earlier
  // For now, showing the structure

  const [otaState, otaActions] = React.useState({
    availableUpdate: null as ZephyrOTAUpdate | null,
    isApplying: false,
    showModal: false,
    showBanner: false,
  });

  // Mock implementation - real version would use useZephyrOTA
  const mockUpdate: ZephyrOTAUpdate = {
    version: '1.2.3',
    description: 'Bug fixes and performance improvements',
    critical: false,
    manifestUrl: 'https://example.com/manifest.json',
    timestamp: new Date().toISOString(),
  };

  return (
    <>
      {children}

      {useBanner ? (
        <ZephyrOTABanner
          update={otaState.availableUpdate}
          visible={otaState.showBanner}
          onPress={() => {
            // Handle banner press
          }}
          onDismiss={() => {
            // Handle banner dismiss
          }}
          style={bannerStyle}
        />
      ) : (
        <ZephyrOTAModal
          update={otaState.availableUpdate}
          isApplying={otaState.isApplying}
          visible={otaState.showModal}
          onAccept={() => {
            // Handle accept
          }}
          onDecline={() => {
            // Handle decline
          }}
          onLater={() => {
            // Handle later
          }}
          style={modalStyle}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    maxWidth: 320,
    width: '100%',
    maxHeight: '80%',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
    color: '#000',
  },
  content: {
    maxHeight: 200,
  },
  version: {
    fontSize: 16,
    fontWeight: '500',
    color: '#007AFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  primaryButtonText: {
    color: 'white',
  },
  secondaryButtonText: {
    color: '#007AFF',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    color: '#000',
  },
  banner: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  bannerDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  dismissButton: {
    padding: 8,
    marginLeft: 8,
  },
  dismissButtonText: {
    fontSize: 16,
    color: 'white',
  },
});
