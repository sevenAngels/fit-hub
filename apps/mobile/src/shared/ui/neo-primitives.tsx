import { Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type TextStyle, type ViewProps, type ViewStyle } from "react-native";

import { neoCardBase, neoColors, neoPrimaryButtonBase, neoShape } from "@/shared/ui/neo-theme";

type NeoCardProps = ViewProps & {
  style?: StyleProp<ViewStyle>;
};

export function NeoCard({ style, ...props }: NeoCardProps) {
  return <View {...props} style={[styles.card, style]} />;
}

type NeoButtonVariant = "primary" | "secondary" | "accent" | "danger";

type NeoButtonProps = Omit<PressableProps, "style"> & {
  label: string;
  variant?: NeoButtonVariant;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

export function NeoButton({ label, variant = "primary", style, labelStyle, ...props }: NeoButtonProps) {
  return (
    <Pressable {...props} style={[styles.buttonBase, variantStyles[variant], style]}>
      <Text style={[styles.buttonLabel, variantLabelStyles[variant], labelStyle]}>{label}</Text>
    </Pressable>
  );
}

type NeoInputProps = TextInputProps & {
  style?: StyleProp<TextStyle>;
};

export function NeoInput({ style, ...props }: NeoInputProps) {
  return <TextInput {...props} style={[styles.inputBase, style]} />;
}

const styles = StyleSheet.create({
  card: {
    ...neoCardBase
  },
  buttonBase: {
    ...neoPrimaryButtonBase,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16
  },
  buttonLabel: {
    color: neoColors.white,
    fontSize: 16,
    fontWeight: "700"
  },
  inputBase: {
    borderRadius: neoShape.radius,
    borderWidth: neoShape.borderWidth,
    borderColor: neoColors.ink,
    backgroundColor: neoColors.white,
    color: neoColors.ink,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10
  }
});

const variantStyles: Record<NeoButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: neoColors.primary
  },
  secondary: {
    backgroundColor: neoColors.secondary
  },
  accent: {
    backgroundColor: neoColors.accent
  },
  danger: {
    backgroundColor: neoColors.destructive
  }
};

const variantLabelStyles: Record<NeoButtonVariant, TextStyle> = {
  primary: {
    color: neoColors.white
  },
  secondary: {
    color: neoColors.ink
  },
  accent: {
    color: neoColors.ink
  },
  danger: {
    color: neoColors.white
  }
};
