import React from 'react'
import {
  View, Text, Modal, Pressable, FlatList, StyleSheet,
} from 'react-native'
import { PlaceMatch } from '../lib/types'
import { colors, spacing, radius } from '../constants/theme'

interface Props {
  matches: PlaceMatch[]
  onSelect: (match: PlaceMatch) => void
  onDismiss: () => void
}

export function AddressMatchPicker({ matches, onSelect, onDismiss }: Props) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Select your address</Text>
          <FlatList
            data={matches}
            keyExtractor={m => m.id}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <Pressable
                style={styles.item}
                onPress={() => onSelect(item)}
                testID={`match-${item.id}`}
              >
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.locality}>{item.locality}</Text>
              </Pressable>
            )}
          />
        </View>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '60%',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  item: { paddingVertical: spacing.md },
  name: { fontSize: 15, color: colors.text },
  locality: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  separator: { height: 1, backgroundColor: colors.border },
})
