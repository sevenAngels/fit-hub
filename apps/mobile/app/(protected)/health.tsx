import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { neoColors } from "@/shared/ui/neo-theme";
import { NeoButton } from "@/shared/ui/neo-primitives";

export default function HealthPage() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Health Feature Disabled</Text>
      <Text style={styles.body}>Health integration is temporarily disabled for current testing mode.</Text>
      <NeoButton
        variant="primary"
        style={styles.button}
        labelStyle={styles.buttonLabel}
        onPress={() => router.replace("/(protected)")}
        label="Back to dashboard"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: neoColors.background,
    gap: 12
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: neoColors.inkSoft
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: neoColors.muted,
    textAlign: "center"
  },
  button: {
    marginTop: 8,
    backgroundColor: neoColors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10
  },
  buttonLabel: {
    color: neoColors.white,
    fontWeight: "700"
  }
});
