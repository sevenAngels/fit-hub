import { Platform, type ViewStyle } from "react-native";

export const neoColors = {
  background: "#fdf7f2",
  surface: "#ffffff",
  ink: "#1e293b",
  inkSoft: "#1f2b3b",
  primary: "#22c55e",
  primaryStrong: "#16a34a",
  authPrimary: "#3d6f39",
  secondary: "#e0f2fe",
  subtleBorder: "#d7e4ef",
  accent: "#fdafbc",
  dangerSoft: "#fee2e2",
  dangerPale: "#fff2f4",
  dangerPaler: "#ffebee",
  dangerBorder: "#f1b0ba",
  dangerStrong: "#8b0015",
  destructive: "#c53030",
  warningSoft: "#fff6e8",
  warningBorder: "#f3c783",
  warningText: "#9b4f00",
  muted: "#64748b",
  mutedStrong: "#7a8ca0",
  successBorder: "#2e7d32",
  successSoft: "#e8f5e9",
  successStrong: "#1e6b2d",
  successText: "#276749",
  dangerText: "#b00020",
  white: "#ffffff"
} as const;

export const neoShape = {
  radius: 12,
  borderWidth: 2
} as const;

export const neoHardShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: neoColors.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0
  },
  android: {
    elevation: 6
  },
  default: {}
});

export const neoCardBase: ViewStyle = {
  backgroundColor: neoColors.surface,
  borderColor: neoColors.ink,
  borderWidth: neoShape.borderWidth,
  borderRadius: neoShape.radius,
  ...neoHardShadow
};

export const neoPrimaryButtonBase: ViewStyle = {
  backgroundColor: neoColors.primary,
  borderColor: neoColors.ink,
  borderWidth: neoShape.borderWidth,
  borderRadius: neoShape.radius,
  ...neoHardShadow
};
