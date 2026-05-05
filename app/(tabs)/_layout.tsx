import { Tabs } from 'expo-router'
import { BottomTabBar } from '../../src/components/BottomTabBar'

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={props => <BottomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="schedule" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="account" />
    </Tabs>
  )
}
