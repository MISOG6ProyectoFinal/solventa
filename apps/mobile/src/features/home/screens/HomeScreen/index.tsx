import { Button, StatusBar, View, Text } from "react-native";

import styles from "./styles";
import { useNavigation } from "@react-navigation/native";
import { useHomeStore } from "../../store";

const HomeScreen: React.FunctionComponent = () => {
  const navigation = useNavigation();
  const counter = useHomeStore(state => state.counter);
  const increaseCounter = useHomeStore(state => state.increaseCounter);

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <View style={styles.mainView}>
        <Text>Counter - {counter}</Text>
        <Button title="Increase" onPress={increaseCounter} />
        <Button title="Go to details" onPress={() => navigation.navigate('Details')} />
      </View>
    </>
  );
};

export default HomeScreen;
