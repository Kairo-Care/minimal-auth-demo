import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { Config } from './Config'
import { PropelAuthProvider } from './wrappers/PropelAuthProvider'
import Entry from './components/Entry';

export default function App() {
  return (
    <PropelAuthProvider config={Config.propelAuth}>
      <Entry></Entry>
    </PropelAuthProvider>
  );
}
