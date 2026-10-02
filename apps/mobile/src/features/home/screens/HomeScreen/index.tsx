import { Button, StatusBar, View, Text } from "react-native";
import { useState } from "react";

import styles from "./styles";

const HomeScreen: React.FunctionComponent = () => {
  const [counter, setCounter] = useState(0);

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <View style={styles.mainView}>
        <Text>Counter - {counter}</Text>
        <Button title="Increase" onPress={() => setCounter((prev) => prev + 1)} />
      </View>
    </>
  );
};

export default HomeScreen;
