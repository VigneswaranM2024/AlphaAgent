import React from 'react';
import { StyleSheet, StatusBar, Platform } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

export default function App() {
  // Pointing to your laptop's local IP address where the Flask API is running.
  const LAPTOP_IP = 'http://10.46.59.1:5000';

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#090d1a" />
        <WebView 
          source={{ uri: LAPTOP_IP }} 
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d1a', // Match the web app's dark theme background
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
