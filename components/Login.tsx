import { View, StyleSheet } from "react-native"
import { useAuthContext } from "../wrappers/PropelAuthProvider"
import Button from "./Button"

export default function Login() {
  const { login } = useAuthContext()

  return (
    <View style={styles.container}>
      <Button label="Login" theme="primary" onPress={login} />
    </View>
  )
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
