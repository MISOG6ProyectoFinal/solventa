import { View, Text, StyleSheet } from 'react-native'
import React from 'react'
import { useHomeStore } from '../../store'

const DetailsScreen = () => {
  const counter = useHomeStore(state => state.counter);

  return (
    <View style={styles.main}>
      <Text>My Details</Text>
      <Text>Current Counter: {counter}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
})

export default DetailsScreen;
