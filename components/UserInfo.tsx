import { StyleSheet, Text, View } from "react-native";
import { useAuthContext } from "../wrappers/PropelAuthProvider";
import Button from "./Button";

export default function UserInfo() {
  const { user, logout } = useAuthContext()
  return (
    <View style={styles.container}>
      <Text>User:</Text>
      <Text>{JSON.stringify(user, null, 2)}</Text>
      <Button label="Logout" theme="primary" onPress={logout} />
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
