import React from 'react'
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing } from '../constants/theme'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

interface TabBarProps {
  state: { index: number; routes: Array<{ name: string }> }
  navigation: { navigate: (name: string) => void }
}

const TABS: { name: string; label: string; icon: IoniconName; activeIcon: IoniconName }[] = [
  { name: 'schedule', label: 'Schedule', icon: 'calendar-outline', activeIcon: 'calendar' },
  { name: 'search',   label: 'Search',   icon: 'search-outline',   activeIcon: 'search'   },
  { name: 'account',  label: 'Account',  icon: 'person-outline',   activeIcon: 'person'   },
]

export function BottomTabBar({ state, navigation }: TabBarProps) {
  return (
    <View style={styles.bar}>
      {TABS.map((tab, index) => {
        const isActive = state.index === index
        return (
          <Pressable
            key={tab.name}
            style={styles.tab}
            onPress={() => navigation.navigate(tab.name)}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            <Ionicons
              name={isActive ? tab.activeIcon : tab.icon}
              size={24}
              color={isActive ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 24 : spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  label: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
})
