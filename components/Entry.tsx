import { useAuthContext } from "../wrappers/PropelAuthProvider";
import UserInfo from "./UserInfo";
import Login from "./Login";

export default function Entry() {
  const { user } = useAuthContext()

  if (user) {
    return (
      <UserInfo></UserInfo>
    )
  }

  return (
    <Login></Login>
  )
}
